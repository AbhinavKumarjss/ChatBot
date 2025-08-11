import { AudioManager } from "./audioManager";

export class Manager{
    ws : WebSocket 
    chat_history:Array<string | null >
    audioManager : AudioManager
    isCallStarted:boolean = false
    onMessageUpdate: (messageId: any, chunk: string, isLoading: boolean, isComplete?: boolean) => void
    onNewMessage: (sender: string, text: string, loading?: boolean) => any
    onVoiceComplete : () => void
    currentMessageId: any = null
    isVoiceMode: boolean = false // Track if we're in voice mode

    constructor(wsUrl: string, onMessageUpdate: (messageId: any, chunk: string, isLoading: boolean, isComplete?: boolean) => void, onNewMessage: (sender: string, text: string, loading?: boolean) => any,onVoiceComplete: ()=>void){
        this.audioManager = new AudioManager();
        this.ws = new WebSocket(wsUrl)
        this.ws.binaryType = "arraybuffer";
        this.chat_history = [];
        this.onMessageUpdate = onMessageUpdate;
        this.onNewMessage = onNewMessage;
        this.onVoiceComplete = onVoiceComplete
        this._SetupWebsocketHandlers();
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    PlayAudioPCMChunks(chunk:ArrayBuffer){
        this.audioManager.AddandPlay(chunk)
    }

    SendChatMessage(question: string, chat_history: Array<string>){
        this.isVoiceMode = false; // Set to text mode
        // Send in the exact format your backend expects
        this.ws.send(JSON.stringify({
            type: "chat",
            question: question,
            chat_history: chat_history
        }));
        // Create a new AI message with loading state
        this.currentMessageId = this.onNewMessage("ai", "", true);
    }
    
    SendVoiceMessage(question: string, chat_history: Array<string>){
        this.isVoiceMode = true; // Set to voice mode
        console.log("Sending voice message");
        // Send in the exact format your backend expects
        this.ws.send(JSON.stringify({
            type: "voice",
            question: question,
            chat_history: chat_history
        }));
        // Create a new AI message with loading state - start empty for transcript
        this.currentMessageId = this.onNewMessage("ai", "", true);
    }

    ChatMessageTranscriptHandler(chunk: string){
        console.log("Received text chunk:", chunk);
        // Update text for both chat and voice messages (to show transcript)
        if (this.currentMessageId && this.onMessageUpdate) {
            this.onMessageUpdate(this.currentMessageId, chunk, true, false);
        }
    }

    VoiceMessageCompleteHandler(){
        console.log("Voice message complete");
        if (this.currentMessageId && this.onMessageUpdate) {
            // Update the speaking message to show it's complete
            this.onMessageUpdate(this.currentMessageId, "", false, true);
            this.currentMessageId = null;
        }
        this.audioManager.onVoiceComplete = this.onVoiceComplete
    }

    ChatMessageCompleteHandler(){
        console.log("Chat message complete");
        if (this.currentMessageId && this.onMessageUpdate) {
            // Don't add empty chunk on completion, just mark as complete
            this.onMessageUpdate(this.currentMessageId, "", false, true);
            this.currentMessageId = null;
        }
    }

    StartCall(){
        this.isCallStarted = true;
        console.log("started call")
    }
    
    _SetupWebsocketHandlers(){
        this.ws.onopen = () =>{
            console.log("Websocket connection opened.")
        }
        
        this.ws.onmessage = (event)=>{
            if(event.data instanceof ArrayBuffer){
                console.log("Audio chunks received, playing...");
                this.PlayAudioPCMChunks(event.data);
            }
            else if (typeof event.data === "string") {
                try {
                    const jsonData = JSON.parse(event.data);
                    console.log("JSON received:", jsonData);
                    
                    // Handle chat responses
                    if (jsonData['type'] === 'chat') {
                        if (jsonData['complete'] === true) {
                            // Chat message is complete
                            this.ChatMessageCompleteHandler();
                        } else if (jsonData['data']) {
                            // Chat text chunk received
                            this.ChatMessageTranscriptHandler(jsonData['data']);
                        }
                    }
                    
                    // Handle voice responses  
                    else if (jsonData['type'] === 'voice') {
                        if (jsonData['complete'] === true) {
                            // Voice message is complete
                            this.VoiceMessageCompleteHandler();
                        } else if (jsonData['data']) {
                            // Voice text chunk received - show transcript while playing audio
                            console.log("Voice transcript chunk:", jsonData['data']);
                            this.ChatMessageTranscriptHandler(jsonData['data']);
                        }
                        // Note: Audio chunks come as ArrayBuffer, handled above
                    }
                    
                    // Handle errors
                    else if (jsonData['error']) {
                        console.error("Server error:", jsonData['error']);
                        if (this.currentMessageId) {
                            this.onMessageUpdate(this.currentMessageId, "Error: " + jsonData['error'], false, true);
                            this.currentMessageId = null;
                        }
                    }
                    
                } catch (err) {
                    console.error("Invalid JSON string: ", err);
                }
            }
        }
        
        this.ws.onclose = () =>{
            console.log("Websocket disconnected successfully")
        }

        this.ws.onerror = (error) => {
            console.error("WebSocket error:", error);
        }
    }
}