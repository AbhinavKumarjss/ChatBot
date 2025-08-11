# Updated AudioGeneratorFromTextGenerator function
from typing import AsyncGenerator, Dict, Any, Union
from config import CONFIG
from elevenlabs.client import ElevenLabs

eleven_api_key = CONFIG.ELEVEN_API_KEY
BUFFER_LENGTH = 150
OUTPUT_FORMAT ="pcm_16000" #"mp3_44100_128" 
#"mp3_44100_128"
async def AudioGeneratorFromTextGenerator(
    text_chunk_generator: AsyncGenerator[str, None],
    model_id: str = 'eleven_flash_v2_5',
    voice_id: str = "jqcCZkN6Knx8BJ5TBdYR"
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Generate audio from text chunks and yield structured data
    """
    buffer = ""
    client = ElevenLabs(api_key=CONFIG.ELEVEN_API_KEY)

    try:
        async for chunk in text_chunk_generator:
            chunk = chunk.strip()
            if not chunk:
                continue

            buffer += chunk + " "


            if len(buffer) > BUFFER_LENGTH or any(punct in buffer for punct in [ "." , "," , "?"]):

                try:
                    audio_stream = client.text_to_speech.stream(
                        text=buffer.strip(),
                        voice_id=voice_id,
                        model_id=model_id,
                        output_format=OUTPUT_FORMAT
                    )
  
                    yield {"type": "text", "data": buffer.strip()}
                
                    for audio_chunk in audio_stream:
                        if audio_chunk:
                            yield {"type": "audio", "data": audio_chunk}
                            
                except Exception as e:
                    print(f"Error generating audio: {e}")
  
                
                buffer = ""

        # Handle remaining buffer content
        if buffer.strip():

            try:
                audio_stream = client.text_to_speech.stream(
                    text=buffer.strip(),
                    voice_id=voice_id,
                    model_id=model_id,
                    output_format=OUTPUT_FORMAT
                )
                yield {"type": "text", "data": buffer.strip()}
            
                for audio_chunk in audio_stream:
                    if audio_chunk:
                        yield {"type": "audio", "data": audio_chunk}
                        
            except Exception as e:
                print(f"Error generating final audio: {e}")
                
    except Exception as e:
        print(f"Error in AudioGeneratorFromTextGenerator: {e}")
        raise

