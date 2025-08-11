import asyncio
from typing import AsyncGenerator, List
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain_pinecone import PineconeVectorStore

from config import CONFIG
from langchain.prompts import PromptTemplate
from langchain.callbacks.base import BaseCallbackHandler
from pc.pinecone import PineconeClient

class LLM:
################################################
##              Class Variables
################################################
    _instance = None
    pc = None
    vectorstore = None
    llm = None
    stream_llm =None
    embeddings = None
    model_name = None
    _initialized=False
################################################
##          SINGLETON INSTANCE
################################################

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LLM, cls).__new__(cls)
        return cls._instance


################################################
##              CONSTRUCTOR
################################################
    def __init__(self, index_name: str = "default" ,model_name:str = "gpt-4o"):
        if self.__class__._initialized:
            return
        print("------------------------- LLM Initialized ----------------------")
        ################## Variable configuration #################          
        self.openai_api_key = CONFIG.OPENAI_API_KEY
        self.pc = PineconeClient(index_name)
        self.model_name = model_name
        ################## OPEN AI MODEL & EMBEDDINGS ##############    

        self.llm = ChatOpenAI(
                openai_api_key=self.openai_api_key, 
                model=model_name,
                temperature=0.7, #increases creativity of model
            )

        self.__class__._initialized = True
    



    #######################################################
    #             Get Response (Non streaming)
    #           Set custom prompt
    #           Set custom response chain based on prompt
    #           try-catch response 
    #           Returns response['answer']
    #######################################################

    async def get_response(self, question: str, chat_history: List[str] = [] , prompt:str = None):

        ################# Prompt converts into Prompt Template ##################

        docs = self.pc.vectorstore.similarity_search(question, k=4)
        context = "\n\n".join([doc.page_content for doc in docs])

        if prompt:
            try:
                system_prompt = prompt.format(
                    context=context,
                )
            except KeyError as e:
                raise ValueError(f"Missing placeholder in prompt: {e}")
        else:
            system_prompt = question  # fallback if no prompt given


        ################## Setting Response chain for custom prompt ###############
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Chat History :\n{chat_history}\n\n Question : {question} ")
            ]      

        ################## Get Response and returns it #####################
        try:
            response = await self.llm.ainvoke(messages)
            return response.content
        except Exception as e:
            print(f"Error in get_response: {e}")
            return None




    #######################################################
    #             Get Response (Streaming)
    #           Set custom prompt
    #           Set llm based on stream_handler
    #           try-catch response 
    #           Returns response['answer']
    #######################################################

    async def get_stream_response(self, question: str, chat_history: List[str]=[], prompt:str = None) -> AsyncGenerator[str, None]:

        ################## Prompt converts into Prompt Template #################

        docs = self.pc.vectorstore.similarity_search(question, k=4)
        context = "\n\n".join([doc.page_content for doc in docs])

        ####################### 3. Inject variables into prompt #######################
        if prompt:
            try:
                system_prompt = prompt.format(
                    context=context,
                )
            except KeyError as e:
                raise ValueError(f"Missing placeholder in prompt: {e}")
        else:
            system_prompt = question  # fallback if no prompt given

        ####################### 4. Initialize streaming LLM #######################
        stream_llm = ChatOpenAI(
            openai_api_key=self.openai_api_key,
            model=self.model_name,
            temperature=0.7,
            streaming=True,
        )
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Chat History :\n{chat_history}\n\n Question : {question} ")
            ]      
        ####################### 5. Stream the response #######################
        async for chunk in stream_llm.astream(messages):
            if hasattr(chunk, 'content') and chunk.content:
                yield chunk.content
