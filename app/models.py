from pydantic import BaseModel, Field, EmailStr
from enum import IntEnum, Enum
from typing import Optional, Literal

class AudioFormat(int, Enum):
    """Audio format options for speech synthesis."""
    WAV = 1
    OPUS = 2

class VoiceModel(str, Enum):
    SABRINA = "sabrina"
    PAUL = "paul"      # Jarvis-style voice
    MORGAN = "morgan"  # Morgan Freeman-style voice

class SpeakSynthRequest(BaseModel):
    """
    Request model for speech synthesis API.
    
    Attributes:
        text: The text to convert to speech
        format: Audio format for the output (1 = WAV, 2 = OPUS)
    """
    text: str = Field(..., description="Text content to synthesize into speech")
    format: AudioFormat = AudioFormat.WAV
    voice: VoiceModel = VoiceModel.SABRINA  # Default voice parameter

    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Hello, this is a test of the speech synthesis system.",
                "format": 1
            }
        }
    }

class UserRegistration(BaseModel):
    """Request model for user registration."""
    email: EmailStr = Field(..., description="User's email address")
    browser_id: str = Field(..., description="Browser fingerprint identifier")
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "browser_id": "abcdef1234567890abcdef1234567890"
            }
        }
    }