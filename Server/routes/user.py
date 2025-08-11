
# Updated WebSocket route
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json
from prompts import get_chat_prompt, get_voice_prompt
from utils.elevenlabs.generator import AudioGeneratorFromTextGenerator
from llm.llm import LLM

user_router = APIRouter(prefix="/user", tags=['Voice'])
llm = LLM()

@user_router.websocket("/ws")
async def Connect(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection established")
    
    try:
        while True:
                message = await websocket.receive_json()

                type = message['type']
                question = message['question'].strip()
                chat_history = message.get('chat_history', [])

                if type == "voice":
                        print(chat_history)
                        text_stream = llm.get_stream_response(question, chat_history, get_voice_prompt())
                        audio_stream = AudioGeneratorFromTextGenerator(text_stream)
                        
                        # Send chunks to client
                        async for chunk in audio_stream:
                            try:
                                if chunk['type'] == "text":
                                    await websocket.send_json({"type":"voice","data":chunk['data']})
                                elif chunk['type'] == "audio":
                                    await websocket.send_bytes(chunk['data'])
                            except Exception as send_error:
                                print(f"Error sending chunk: {send_error}")
                                break
                        await websocket.send_json({"type":"voice","complete":True})

                elif type == "chat":
                    buffer = ""
                    text_stream = llm.get_stream_response(question,chat_history,get_chat_prompt())
                    async for chunk in text_stream:
                        buffer += chunk
                        if any(punct in buffer for punct in [".", "?", ","]):
                            try:
                                await websocket.send_json({"type":"chat","data":buffer})
                                buffer=""
                            except Exception as send_error:
                                print(f"Error sending chunk: {send_error}")
                                break
                    
                    if buffer.strip():
                        try:
                                await websocket.send_json({"type":"chat","data":buffer})
                                buffer=""
                        except Exception as e:
                            print(f"Error generating final audio: {e}")
                    await websocket.send_json({"type":"chat","complete":True})
                else: 
                    websocket.send_json({"error":"Request type not specified on server."})


                
    except json.JSONDecodeError as json_error:
        print(f"JSON decode error: {json_error}")
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as receive_error:
        print(f"Error receiving message: {receive_error}")
