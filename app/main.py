from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from app.models import SpeakSynthRequest, AudioFormat  # Import from models.py
from gradio_client import Client, handle_file
import tempfile, os, subprocess
from app.auth import verify_api_key
from app.ratelimit import enforce_daily_limit
from app.db import get_db_conn
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware  # Add this import

app = FastAPI(
    title="SpeakSynth - Text-to-Speech API",
    description="🎙️ Transform your words into lifelike voice with SpeakSynth, powered by AI.",
    version="1.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://speaksynth.onrender.com",  # Your production frontend
        "http://127.0.0.1:5500",           # Common local development server
        "http://localhost:5500",           # Alternative local development URL
    ],
    # enable CORS for all API endpoints
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

client = Client("ResembleAI/Chatterbox")

# SpeakSynthRequest is now imported from models.py

@app.get("/speaksynth/health")
async def health_check():
    """Check if the API is running."""
    return JSONResponse(content={"status": "ok", "message": "🔊 SpeakSynth API is alive!"})

@app.post("/speaksynth/api/v1/register")
async def register_key(request: Request):
    """
    Register a new API key based on user IP.
    Limits: 1 API key per IP address.
    """
    from uuid import uuid4
    import logging

    ip = request.client.host
    key = str(uuid4())
    conn = None

    try:
        conn = get_db_conn()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed.")
        
        # Enable foreign keys
        conn.execute("PRAGMA foreign_keys = ON")
        cur = conn.cursor()

        # Look for existing user with this IP
        cur.execute("SELECT api_key FROM users WHERE ip_address = ?", (ip,))
        existing_key = cur.fetchone()
        
        if existing_key:
            # User already has a key
            return JSONResponse(
                status_code=200,
                content={
                    "message": "⚠️ You already have an API key.",
                    "api_key": existing_key[0],
                    "daily_limit": 50,
                    "note": "Your existing API key has been retrieved."
                }
            )

        # Check IP log entry or create it
        cur.execute("SELECT attempts FROM ip_logs WHERE ip_address = ?", (ip,))
        row = cur.fetchone()

        if row:
            attempts = row[0]
            if attempts >= 1:
                raise HTTPException(status_code=429, detail="Too many API keys created from this IP.")
            # Update attempts
            cur.execute("UPDATE ip_logs SET attempts = attempts + 1 WHERE ip_address = ?", (ip,))
        else:
            # Create new IP log first (needed for foreign key)
            cur.execute("INSERT INTO ip_logs (ip_address, attempts) VALUES (?, ?)", (ip, 1))

        # Create user with IP association
        cur.execute(
            "INSERT INTO users (api_key, ip_address, daily_count, last_used) VALUES (?, ?, ?, date('now'))",
            (key, ip, 0)
        )
        conn.commit()

        return JSONResponse(content={
            "message": "✅ Your SpeakSynth API Key has been generated.",
            "api_key": key,
            "daily_limit": 50,
            "note": "Store this key securely. This will not be shown again."
        })

    except Exception as e:
        if conn:
            conn.rollback()
        logging.exception(f"Key registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error registering API key. Please try again later.")
    finally:
        if conn:
            conn.close()

@app.post("/speaksynth/api/v1/synthesize")
async def synthesize_speech(
    request: SpeakSynthRequest,
    background_tasks: BackgroundTasks,
    x_api_key: str = Header(...),
    _ = Depends(verify_api_key),
    __ = Depends(enforce_daily_limit)
):
    """
    Convert text to speech using AI.
    
    Args:
        request: Contains the text to synthesize and output format
        background_tasks: FastAPI background tasks
        x_api_key: API key from header
        
    Returns:
        Audio file response (WAV or OPUS)
    """
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    result = client.predict(
        text_input=request.text,
        audio_prompt_path_input=handle_file("https://raw.githubusercontent.com/RudrasSingh/playlist-randomizer/bd4afeb10611ad36529691440a914fcfb6a28dfd/Sabrina%20Carpenter%20Answers%20the%20Web's%20Most%20Searched%20Questions%20%20WIRED.mp3"),
        exaggeration_input=0.5,
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

# @app.get("/speaksynth/api/v1/usage")
# async def check_usage(
#     x_api_key: str = Header(...),
#     _ = Depends(verify_api_key)
# ):
#     """
#     Get the current API usage statistics for the authenticated user.
#     Returns the number of API calls made today and the daily limit.
#     """
#     conn = None
#     try:
#         today = datetime.now().date()
#         conn = get_db_conn()
#         if conn is None:
#             raise HTTPException(status_code=500, detail="Database connection failed")
#         cur = conn.cursor()
        
#         # Change %s to ? for SQLite
#         cur.execute("SELECT daily_count, last_used FROM users WHERE api_key = ?", (x_api_key,))
#         user = cur.fetchone()
        
#         if not user:
#             raise HTTPException(status_code=401, detail="Invalid API key")
            
#         count, last_used = user
        
#         # SQLite will store dates as strings, so we need to convert
#         if isinstance(last_used, str):
#             last_used = datetime.strptime(last_used, "%Y-%m-%d").date()
#         elif isinstance(last_used, datetime):
#             last_used = last_used.date()
            
#         # If it's a new day, the count should be reset
#         if last_used != today:
#             count = 0
            
#         return JSONResponse(content={
#             "daily_usage": count,
#             "daily_limit": 50,
#             "remaining": 50 - count,
#             "date": str(today)
#         })
        
#     except Exception as e:
#         if conn:
#             conn.rollback()
#         raise HTTPException(status_code=500, detail="Error retrieving usage information")
#     finally:
#         if conn:
#             conn.close()

@app.get("/speaksynth/api/v1/usage")  # Changed path to avoid duplicate
async def check_my_usage(request: Request):
    """
    Get the current API usage statistics for the current IP address.
    Returns the number of API calls made today and the daily limit.
    """
    ip = request.client.host
    conn = None
    
    try:
        today = datetime.now().date()
        conn = get_db_conn()
        if conn is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        cur = conn.cursor()
        
        # Find API key for this IP
        cur.execute("SELECT api_key FROM users WHERE ip_address = ?", (ip,))
        result = cur.fetchone()
        
        if not result:
            return JSONResponse(content={
                "message": "No API key found for your IP address",
                "daily_usage": 0,
                "daily_limit": 50,
                "remaining": 50
            })
            
        api_key = result[0]
        
        # Get usage data
        cur.execute("SELECT daily_count, last_used FROM users WHERE api_key = ?", (api_key,))
        user = cur.fetchone()
        
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
            "api_key": api_key,  # Include the API key for convenience
            "daily_usage": count,
            "daily_limit": 50,
            "remaining": 50 - count,
            "date": str(today)
        })
        
    except Exception as e:
        if conn:
            conn.rollback()
        logging.exception(f"Usage check error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error retrieving usage information")
    finally:
        if conn:
            conn.close()
