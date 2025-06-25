from pydantic import BaseModel, Field, field_serializer
from enum import IntEnum
from typing import Optional, Literal

class AudioFormat(IntEnum):
    """Audio format options for speech synthesis."""
    WAV = 1
    OPUS = 2

class SpeakSynthRequest(BaseModel):
    """
    Request model for speech synthesis API.
    
    Attributes:
        text: The text to convert to speech
        format: Audio format for the output (1 = WAV, 2 = OPUS)
    """
    text: str = Field(..., description="Text content to synthesize into speech")
    format: Literal[1, 2] = Field(
        default=1, 
        description="Output audio format: 1=WAV, 2=OPUS"
    )
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "text": "Hello, this is a test of the speech synthesis system.",
                "format": 1
            }
        }
    }