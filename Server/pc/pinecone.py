from typing import List
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone, ServerlessSpec
from config import CONFIG


class PineconeClient:
    _instance = None
    _initialized = False

    pc = None
    pinecone_api_key = None
    openai_api_key = None
    index_name = None
    embeddings = None
    vectorstore = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(PineconeClient, cls).__new__(cls)
        return cls._instance

    def __init__(self,index_name :str = "default"):
        if self.__class__._initialized:
            return  # Prevent reinitialization
        print("------------------------- Pinecone Initialized ----------------------")
        self.openai_api_key = CONFIG.OPENAI_API_KEY
        self.pinecone_api_key = CONFIG.PINECONE_API_KEY
        self.pc = Pinecone(self.pinecone_api_key)
        self.index_name = index_name
        self.embeddings = OpenAIEmbeddings(openai_api_key=self.openai_api_key)  
        self._create_index_if_not_exists()
        self.vectorstore = PineconeVectorStore.from_existing_index(
            index_name=self.index_name, 
            embedding=self.embeddings
        )
        self.__class__._initialized = True

    def _create_index_if_not_exists(self, dimension: int = 1536, metric: str = "cosine"):
        """Private method to create a vector index if it doesn't exist."""
        # Using .list_indexes().names() is more efficient than .has_index()

        if self.index_name not in self.pc.list_indexes().names():
            print(f"Creating index '{self.index_name}'...")
            self.pc.create_index(
                name=self.index_name,
                dimension=dimension,
                metric=metric,
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            print(f"Index '{self.index_name}' created successfully.")
            return True
        else:
            print(f"Index '{self.index_name}' already exists. Skipping creation.")
            return False

    def delete_index(self) -> bool:
        """Delete the vector index"""
        if self.pc.has_index(self.index_name):
            print(f"Deleting index '{self.index_name}'...")
            self.pc.delete_index(self.index_name)
            print(f"Pinecone : Index '{self.index_name}' deleted successfully.")
            return True
        else:
            print(
                f"Pinecone : Index '{self.index_name}' does not exist. No action taken."
            )
            return False

    def add_data_to_index(self, text_array: List[str]) -> bool:
        """Add text data to the vector index"""
        if self.pc.has_index(self.index_name):
            concatenated_text = "".join(text.replace("\n", "") for text in text_array)
            docs_array = [Document(page_content=concatenated_text)]
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=100
            )
            docs = text_splitter.split_documents(documents=docs_array)
            if self.vectorstore is not None:
                self.vectorstore.add_documents(documents=docs)
                return True
            else:
                print("Pinecone : Vector store not initialized. Cannot add documents.")
                return False

    def add_scrape_data(self, chunks: List[dict]):
        documents = [
            Document(
                page_content=chunk["content"],
                metadata={
                    "source_url": chunk["source_url"],
                    "chunk_index": chunk.get("chunk_index", i),
                    "total_chunks": chunk.get("total_chunks", len(chunks)),
                    "char_count": len(chunk["content"]),
                },
            )
            for i, chunk in enumerate(chunks)
        ]

        if self.vectorstore is not None:
            self.vectorstore.add_documents(documents=documents)
        else:
            print("Pinecone : Vector store not initialized. Cannot add documents.")



    def query_index(self, query_text: str, k: int = 5):
        """Query the vector index for similar content"""
        if self.vectorstore:
            print(f"Pinecone : Querying index '{self.index_name}' with: '{query_text}'")
            results = self.vectorstore.similarity_search(query=query_text, k=k)
            print("\n--- Query Results ---")
            for i, doc in enumerate(results):
                print(f"Pinecone : Result {i+1}:")
                print(f"Pinecone : Content: {doc.page_content[:200]}...")
                print("-" * 20)
            return results
        else:
            print("Pinecone : Vector store not initialized. Cannot perform query.")
            return []

    def switch_index(self, index_name: str) :
        print(f"Configuring client for index: '{index_name}'")
        hasCreated = False
        try:
            self.index_name = index_name
            hasCreated = self._create_index_if_not_exists()

            self.vectorstore = PineconeVectorStore.from_existing_index(
                index_name=self.index_name, embedding=self.embeddings
            )
            print(f"Successfully connected to vector store for index '{self.index_name}'")
            return True,hasCreated

        except Exception as e:
            print(f"Error while switching to index '{index_name}': {e}")
            return False, hasCreated

    def getIndexName(self) -> str:
        return self.index_name

    def getEmbeddings(self):
        return self.embeddings

    def setEmbeddings(self, new_embeddings):
        self.embeddings = new_embeddings
        
    def getVectorStore(self):
        return self.vectorstore