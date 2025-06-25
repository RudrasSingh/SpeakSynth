from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from gradio_client import Client, handle_file
import tempfile
import os
import subprocess
import uvicorn

app = FastAPI(
    title="SpeakSynth - Text-to-Speech API",
    description="🎙️ Transform your words into lifelike voice with SpeakSynth, a high-quality TTS engine powered by AI.",
    version="1.0.0"
)

# Initialize Gradio Client (you can change this if using your own model)
client = Client("ResembleAI/Chatterbox")

# Request body model
class SpeakSynthRequest(BaseModel):
    text: str
    format: int = 1  # 1 = WAV, 2 = OPUS

@app.get("/speaksynth/health", tags=["Meta"])
async def health_check():
    return JSONResponse(content={"status": "ok", "message": "🔊 SpeakSynth API is alive and vibing!"})

@app.post("/speaksynth/api/v1/synthesize", tags=["Synthesis"])
async def synthesize_speech(request: SpeakSynthRequest, background_tasks: BackgroundTasks):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    
    if request.format not in [1, 2]:
        raise HTTPException(status_code=400, detail="Format must be 1 (WAV) or 2 (OPUS)")

    # Generate speech using the model
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

    # Format: WAV
    if request.format == 1:
        return FileResponse(
            path=wav_path,
            media_type="audio/wav",
            filename="speaksynth_output.wav"
        )

    # Format: OPUS
    opus_fd, opus_path = tempfile.mkstemp(suffix=".opus")
    os.close(opus_fd)

    subprocess.run([
        "ffmpeg", "-y", "-i", wav_path, "-c:a", "libopus", opus_path
    ], check=True)

    # Auto-cleanup temp OPUS file
    def cleanup(path):
        try:
            os.remove(path)
        except Exception:
            pass

    background_tasks.add_task(cleanup, opus_path)

    return FileResponse(
        path=opus_path,
        media_type="audio/ogg",
        filename="speaksynth_output.opus"
    )

if __name__ == "__main__":
    uvicorn.run("speaksynth:app", host="127.0.0.1", port=8000, reload=True)
