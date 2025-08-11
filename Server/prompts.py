# prompt_manager.py

DEFAULT_CHAT_PROMPT = """You are a conversational assistant working for a company. 
Answer the user's questions based on context, chat history and should look interesting.

Context: 
{context}
"""

DEFAULT_VOICE_PROMPT = """You are a conversational voice assistant working for a company.
Answer the user's questions based on context, chat history and should talk interactively.

Context: 
{context}
"""

# Initialize current values
chat_prompt = DEFAULT_CHAT_PROMPT
voice_prompt = DEFAULT_VOICE_PROMPT


def set_chat_prompt(system_prompt: str):
    global chat_prompt
    chat_prompt = system_prompt


def set_voice_prompt(system_prompt: str):
    global voice_prompt
    voice_prompt = system_prompt


def get_chat_prompt() -> str:
    return chat_prompt


def get_voice_prompt() -> str:
    return voice_prompt


def reset_chat_prompt():
    global chat_prompt
    chat_prompt = DEFAULT_CHAT_PROMPT


def reset_voice_prompt():
    global voice_prompt
    voice_prompt = DEFAULT_VOICE_PROMPT
