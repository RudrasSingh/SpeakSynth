from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Header, Request
from fastapi.responses import FileResponse, JSONResponse
from app.models import SpeakSynthRequest, UserRegistration, AudioFormat
from app.auth import verify_api_key, create_or_validate_user
from app.ratelimit import enforce_daily_limit
from app.db import get_db_conn
from gradio_client import Client, handle_file
import tempfile, os, subprocess
from datetime import datetime
import logging
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="SpeakSynth - Text-to-Speech API",
    description="🎙️ Transform your words into lifelike voice with SpeakSynth, powered by AI.",
    version="1.0.0", 
    docs_url=None, 
    redoc_url=None
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://speaksynth.onrender.com",
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
        raise HTTPException(status_code=500, detail="Error registering API key. Please try again later.")

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
            raise HTTPException(status_code=500, detail="Database connection failed")
        cur = conn.cursor()
        
        cur.execute("SELECT daily_count, last_used FROM users WHERE api_key = ?", (x_api_key,))
        user = cur.fetchone()
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid API key")
            
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
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail="Error retrieving usage information")
    finally:
        if conn:
            conn.close()
