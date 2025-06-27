from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from app.models import SpeakSynthRequest, UserRegistration, AudioFormat
from app.auth import verify_api_key, create_or_validate_user
from app.ratelimit import enforce_daily_limit
from app.db import get_db_conn
from gradio_client import Client, handle_file
import tempfile, os, subprocess, re
from datetime import datetime
import logging
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI(
    title="SpeakSynth - Text-to-Speech API",
    description="🎙️ Transform your words into lifelike voice with SpeakSynth, powered by AI.",
    version="1.0.0", 
    docs_url=None, 
    redoc_url=None
)

# CORS middleware configuration - add all three servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://speaksynth.onrender.com",
        "https://speaksynth-6ck5.onrender.com",
        "https://speaksynth3.onrender.com",
        "https://speaksynth.vercel.app",  # Your production frontend
        "https://www.speaksynth.vercel.app",  # Adding www subdomain just in case
        "http://speaksynth.vercel.app", # Non-HTTPS version
        "http://127.0.0.1:5500",        # Common local development server
        "http://localhost:5500",        # Alternative local development URL
        "http://localhost:3000",        # React development server
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],  # Add HEAD method
    allow_headers=["Content-Type", "X-API-Key", "Authorization", "Origin", "Accept"],  # Add more headers
    expose_headers=["Content-Type", "Content-Length"],  # Expose headers for frontend
    max_age=600,  # Cache preflight requests for 10 minutes
)

client = Client("ResembleAI/Chatterbox")

# Custom exception handler for better error responses
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": str(exc.detail),
            "status": "error",
            "status_code": exc.status_code,
            "error_type": "http_error"
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": str(exc),
            "status": "error",
            "status_code": 422,
            "error_type": "validation_error"
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logging.exception("Unexpected error occurred")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "status": "error",
            "status_code": 500,
            "error_type": "server_error",
            "server_message": str(exc)[:200]  # Limit length for security
        }
    )

@app.get("/speaksynth/health")
async def health_check():
    """Check if the API is running."""
    return JSONResponse(content={"status": "ok", "message": "🔊 SpeakSynth API is alive!"})

@app.post("/speaksynth/api/v1/register")
async def register_key(user: UserRegistration):
    """
    Register a new API key based on email and browser fingerprint.
    Returns the existing API key if the same email+browser has been used before.
    """
    try:
        result = create_or_validate_user(email=user.email, browser_id=user.browser_id)
        
        message = "✅ Your SpeakSynth API Key has been generated."
        if not result["is_new"]:
            message = "⚠️ You already have an API key."
        
        return JSONResponse(content={
            "message": message,
            "api_key": result["api_key"],
            "daily_limit": 50,
            "note": "Store this key securely." if result["is_new"] else "Your existing API key has been retrieved."
        })

    except Exception as e:
        logging.exception(f"Key registration error: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail={
                "message": "Error registering API key. Please try again later.",
                "error_type": "registration_error"
            }
        )

@app.post("/speaksynth/api/v1/sync-key")
async def sync_api_key(
    user: UserRegistration,
    x_api_key: str = Header(...)
):
    """
    Sync an API key from another server to this one.
    This allows users to use their API key across all servers.
    """
    try:
        # Extract email and browser_id from the request
        email = user.email
        browser_id = user.browser_id
        
        # Validate the inputs
        if not email or not browser_id or not x_api_key:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Email, browser ID, and API key are required",
                    "error_type": "validation_error"
                }
            )
        
        # Connect to database
        conn = get_db_conn()
        if not conn:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "Database connection failed",
                    "error_type": "database_error"
                }
            )
            
        try:
            cur = conn.cursor()
            today = datetime.now().date().isoformat()  # Ensure date is stored as string
            
            # First check if the tables exist with proper schema
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
            if not cur.fetchone():
                # If table doesn't exist, create it
                from app.db import create_tables
                create_tables(conn)
                logging.info("Created missing users table during sync operation")
            
            # Check if user exists by browser_id
            cur.execute("SELECT email FROM users WHERE browser_id = ?", (browser_id,))
            existing_user = cur.fetchone()
            
            # Generate a unique ID for this user if needed
            unique_id = f"{email}-{browser_id[:16]}"
            
            if existing_user:
                # User exists, update their API key to match the one from the other server
                try:
                    cur.execute(
                        "UPDATE users SET api_key = ? WHERE browser_id = ?",
                        (x_api_key, browser_id)
                    )
                except sqlite3.OperationalError as e:
                    # If update fails due to schema mismatch, try with the alternate schema
                    if "no such column" in str(e):
                        cur.execute(
                            "UPDATE users SET api_key = ?, last_used = ? WHERE browser_id = ?",
                            (x_api_key, today, browser_id)
                        )
                logging.info(f"Updated API key for existing user with browser_id {browser_id[:8]}...")
            else:
                # User doesn't exist, create new entry with the provided API key
                try:
                    # Try inserting with the schema from db.py
                    cur.execute(
                        "INSERT INTO users (api_key, email, browser_id, unique_id, daily_count, last_used, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
                        (x_api_key, email, browser_id, unique_id, today, today)
                    )
                except sqlite3.OperationalError:
                    # If that fails, try with the alternate schema mentioned in the sync endpoint
                    cur.execute(
                        "INSERT INTO users (email, browser_id, api_key, created_at, last_used, daily_count) VALUES (?, ?, ?, ?, ?, 0)",
                        (email, browser_id, x_api_key, today, today)
                    )
                
                logging.info(f"Created new user during sync with browser_id {browser_id[:8]}...")
                
            conn.commit()
            
            return JSONResponse(content={
                "message": "API key synchronized successfully",
                "synced": True
            })
            
        except Exception as e:
            conn.rollback()
            logging.exception(f"Database error during API key sync: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail={
                    "message": f"Database error: {str(e)}",
                    "error_type": "database_error"
                }
            )
        finally:
            conn.close()
            
    except HTTPException:
        raise
    except Exception as e:
        logging.exception(f"API key sync error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail={
                "message": f"Failed to sync API key: {str(e)}",
                "error_type": "sync_error"
            }
        )

@app.post("/speaksynth/api/v1/synthesize")
async def synthesize_speech(
    request: SpeakSynthRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(...),
    _ = Depends(verify_api_key),
    __ = Depends(enforce_daily_limit)
):
    """Convert text to speech using AI."""
    if not request.text:
        raise HTTPException(
            status_code=400, 
            detail={
                "message": "Text cannot be empty",
                "error_type": "validation_error"
            }
        )

    try:
        result = client.predict(
            text_input=request.text,
            audio_prompt_path_input=handle_file("https://raw.githubusercontent.com/RudrasSingh/playlist-randomizer/bd4afeb10611ad36529691440a914fcfb6a28dfd/Sabrina%20Carpenter%20Answers%20the%20Web's%20Most%20Searched%20Questions%20%20WIRED.mp3"),
            exaggeration_input=0.6,
            temperature_input=0.8,
            seed_num_input=0,
            cfgw_input=0.5,
            api_name="/generate_tts_audio"
        )

        wav_path = result if isinstance(result, str) else result[0]
        
        # Add WAV to cleanup
        def cleanup(path): os.remove(path) if os.path.exists(path) else None
        
        if request.format == AudioFormat.WAV:
            background_tasks.add_task(cleanup, wav_path)
            return FileResponse(wav_path, media_type="audio/wav", filename="speaksynth_output.wav")

        opus_fd, opus_path = tempfile.mkstemp(suffix=".opus")
        os.close(opus_fd)

        subprocess.run(["ffmpeg", "-y", "-i", wav_path, "-c:a", "libopus", opus_path], check=True)

        background_tasks.add_task(cleanup, wav_path)  # Clean up WAV file
        background_tasks.add_task(cleanup, opus_path)  # Clean up OPUS file

        return FileResponse(opus_path, media_type="audio/ogg", filename="speaksynth_output.opus")
        
    except Exception as e:
        error_message = str(e)
        logging.exception(f"Speech synthesis error: {error_message}")
        
        # Handle GPU quota error specifically
        if "exceeded your GPU quota" in error_message:
            # Extract time remaining from error message
            time_match = re.search(r"Try again in (\d+):(\d+):(\d+)", error_message)
            
            if time_match:
                hours, minutes, seconds = map(int, time_match.groups())
                total_minutes = hours * 60 + minutes
                
                if total_minutes > 60:
                    wait_message = f"Please try again in about {hours} hours"
                elif total_minutes > 0:
                    wait_message = f"Please try again in about {total_minutes} minutes"
                else:
                    wait_message = f"Please try again in {seconds} seconds"
                
                raise HTTPException(
                    status_code=503,  # Service Unavailable
                    detail={
                        "message": f"The speech synthesis service is currently at capacity. {wait_message}.",
                        "error_type": "gpu_quota_exceeded",
                        "wait_time": {
                            "hours": hours,
                            "minutes": minutes,
                            "seconds": seconds
                        }
                    }
                )
            else:
                raise HTTPException(
                    status_code=503,
                    detail={
                        "message": "The speech synthesis service is temporarily unavailable. Please try again later.",
                        "error_type": "gpu_quota_exceeded"
                    }
                )
        
        # Generic error handling
        raise HTTPException(
            status_code=500,
            detail={
                "message": "Speech synthesis failed. Please try again later.",
                "error_type": "synthesis_error",
                "error": str(e)[:200]  # Limit error message length for security
            }
        )

@app.get("/speaksynth/api/v1/usage")
async def check_usage(
    x_api_key: str = Header(...),
    _ = Depends(verify_api_key)
):
    """Get the current API usage statistics for the authenticated user."""
    conn = None
    try:
        today = datetime.now().date()
        conn = get_db_conn()
        if conn is None:
            raise HTTPException(
                status_code=500, 
                detail={
                    "message": "Database connection failed",
                    "error_type": "database_error"
                }
            )
            
        cur = conn.cursor()
        
        cur.execute("SELECT daily_count, last_used FROM users WHERE api_key = ?", (x_api_key,))
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(
                status_code=401, 
                detail={
                    "message": "Invalid API key",
                    "error_type": "authentication_error"
                }
            )
            
        count, last_used = user
        
        # SQLite will store dates as strings, so we need to convert
        if isinstance(last_used, str):
            last_used = datetime.strptime(last_used, "%Y-%m-%d").date()
        elif isinstance(last_used, datetime):
            last_used = last_used.date()
            
        # If it's a new day, the count should be reset
        if last_used != today:
            count = 0
            
        return JSONResponse(content={
            "daily_usage": count,
            "daily_limit": 50,
            "remaining": 50 - count,
            "date": str(today)
        })
        
    except Exception as e:
        if not isinstance(e, HTTPException):
            logging.exception(f"Usage check error: {str(e)}")
            if conn:
                conn.rollback()
            raise HTTPException(
                status_code=500, 
                detail={
                    "message": "Error retrieving usage information",
                    "error_type": "usage_error",
                    "error": str(e)[:200]
                }
            )
        else:
            raise
    finally:
        if conn:
            conn.close()
