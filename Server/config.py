import os
import getpass
from dotenv import load_dotenv
################################
# ENVIRONMENT CONFIG CLASS
################################


class _Config:
    
    def __init__(self):
        load_dotenv()

    @property
    def OPENAI_API_KEY(self):
        return os.getenv("OPENAI_API_KEY")

    @property
    def PINECONE_API_KEY(self):
        return os.getenv("PINECONE_API_KEY")

    @property
    def ELEVEN_API_KEY(self):
        return os.getenv("ELEVEN_API_KEY")

CONFIG = _Config()

