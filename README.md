# 🎙️ AI Voice-to-Voice Chatbot

A powerful **Voice + Text AI Chatbot** that can scrape any company's website, build a knowledge base, and instantly provide **personalized assistance**.  
Built with **FastAPI**, **LangChain**, **OpenAI**, **Pinecone**, and real-time **chunked audio streaming** for smooth voice interactions.

---

## ✨ Features

- **Voice-to-Voice Mode** — Speak naturally, get instant voice responses.
- **Text Mode** — Chat like a normal chatbot with contextual memory.
- **Website Scraper** — Scrapes any company's site to instantly create a knowledge base.
- **Vector Search** — Stores embeddings in **Pinecone** for semantic search.
- **Real-Time Audio Streaming** — Captures, buffers, and sends audio chunks for fast processing.
- **Chunked Audio Scheduling** — Streams playback seamlessly without gaps.

---

## 🛠️ Tech Stack

| Component  | Technology |
|------------|------------|
| Backend    | **FastAPI** |
| AI Engine  | **LangChain** + **OpenAI GPT** |
| Vector DB  | **Pinecone** |
| Audio Processing | PCM audio chunks (Web APIs) |
| Streaming  | WebSocket |
| Deployment | Docker-ready |

---

## 📡 Voice-to-Voice Workflow

Below is how **audio chunks** flow from microphone to AI response:

### 1️⃣ User Speaks
- Microphone captures **raw PCM audio** via browser's Web Audio API.
- Audio is split into **small chunks** (e.g., 20–50ms each).

### 2️⃣ Chunks Sent to Backend
- Each chunk is **streamed** to the FastAPI backend over **WebSocket**.
- Chunks are added to an **audio buffer**.

### 3️⃣ Transcription
- The backend passes buffered chunks to **OpenAI Whisper** (or similar) in **real time**.
- Transcribed text is sent to the chatbot engine.

### 4️⃣ AI Response
- **LangChain** queries:
  1. The scraped company data (stored in **Pinecone**).
  2. The **LLM** (OpenAI GPT).
- The chatbot generates a **text response**.

### 5️⃣ Voice Synthesis
- The text is sent to **Text-to-Speech** (TTS) API.
- TTS returns **PCM chunks** of speech audio.

### 6️⃣ Smooth Playback
- PCM chunks are buffered and scheduled **one after another** using the **AudioContext** API.
- Playback is **gapless** because each chunk is timestamped and queued in sequence.

---

## 🔍 Why PCM and Not MP3 for Streaming?
- **PCM (Pulse Code Modulation)** is raw, uncompressed audio.
- It avoids decoding delays, allowing **low-latency streaming**.
- MP3 is compressed and requires **full decoding before playback**, introducing lag.

---

## 📦 Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/voice-ai-chatbot.git
cd voice-ai-chatbot

# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn main:app --reload
