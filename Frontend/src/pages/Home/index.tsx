import { useRef, useEffect, useState } from "react";
import { IoSend, IoCall, IoCallSharp } from "react-icons/io5";
import { Manager } from "../../managers/manager";



export default function Home() {
    const ASSISTANT_WIDTH = 400;
    const ASSISTANT_HEIGHT = 550;

    const dragRef = useRef(null);
    const assistantRef = useRef(null);
    const managerRef = useRef(null);
    const chatContainerRef = useRef(null);
    const [chatOpen, setChatOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([
        { id: Date.now(), text: "👋 Hello! How can I help you today?", sender: "ai", animDelay: 0, loading: false }
    ]);
    const [isVoiceMode, setIsVoiceMode] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [currentTranscript, setCurrentTranscript] = useState("");
    const [isCallActive, setIsCallActive] = useState(false);
    const [isAISpeaking, setIsAISpeaking] = useState(false);
    const recognitionRef = useRef(null);
    const currentTranscriptMessageId = useRef(null);
    const isCallActiveRef = useRef(isCallActive); 
    const pauseTimerRef = useRef(null);
    const lastSpeechTimeRef = useRef(null);
    const finalTranscriptRef = useRef("");
    const isProcessingVoiceRef = useRef(false);
    const isAISpeakingRef = useRef(false);
    const aiSpeakingTimeoutRef = useRef(null);
    const PAUSE_DURATION = 300; // Increased pause duration for better detection
    const AI_SPEAKING_GRACE_PERIOD = 1000; // Wait period after AI finishes before listening

    // Initialize Manager when chat opens
    useEffect(() => {
        if (chatOpen && !managerRef.current) {
            const wsUrl = "ws://localhost:8000/api/user/ws";
            
            const onMessageUpdate = (messageId, chunk, isLoading, isComplete = false) => {
                setMessages(prev => prev.map(msg => 
                    msg && msg.id === messageId 
                        ? { 
                            ...msg, 
                            text: msg.text + chunk,
                            loading: isComplete ? false : isLoading 
                          }
                        : msg
                ).filter(msg => msg != null));

                // Track AI speaking state with improved timing
                if (isLoading && chunk) {
                    setIsAISpeaking(true);
                    isAISpeakingRef.current = true;
                    
                    // Clear any existing timeout
                    if (aiSpeakingTimeoutRef.current) {
                        clearTimeout(aiSpeakingTimeoutRef.current);
                    }
                } 
            };
            const onVoiceComplete = () =>{
                console.log("completed voice")
                aiSpeakingTimeoutRef.current = setTimeout(() => {
                    setIsAISpeaking(false);
                    isAISpeakingRef.current = false;
                }, AI_SPEAKING_GRACE_PERIOD);
            }
            const onNewMessage = (sender, text, loading = false) => {
                const messageId = Date.now() + Math.random();
                setMessages(prev => [...prev, { 
                    id: messageId, 
                    text: text, 
                    sender: sender, 
                    loading: loading,
                    animDelay: 0 
                }]);

                // If AI starts a new message, mark as speaking
                if (sender === "ai" && loading) {
                    setIsAISpeaking(true);
                    isAISpeakingRef.current = true;
                    
                    // Clear any existing timeout
                    if (aiSpeakingTimeoutRef.current) {
                        clearTimeout(aiSpeakingTimeoutRef.current);
                    }
                }

                return messageId;
            };

            managerRef.current = new Manager(wsUrl, onMessageUpdate, onNewMessage , onVoiceComplete);
            setIsConnected(true);
        } else if (!chatOpen && managerRef.current) {
            managerRef.current.disconnect();
            managerRef.current = null;
            setIsConnected(false);
        }
    }, [chatOpen]);

    useEffect(() => {
        isCallActiveRef.current = isCallActive;
    }, [isCallActive]);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    // Setup Web Speech API for voice mode with improved AI speaking detection
    useEffect(() => {
        if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
            const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = true;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = "en-US";
            
            recognitionRef.current.onresult = (event) => {
                // Don't process speech if AI is speaking
                if (isAISpeakingRef.current) {
                    return;
                }

                let interimTranscript = "";
                let newFinalTranscript = "";

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        newFinalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }

                const fullTranscript = finalTranscriptRef.current + newFinalTranscript + interimTranscript;
                
                if (fullTranscript.trim()) {
                    setCurrentTranscript(fullTranscript);

                    if (currentTranscriptMessageId.current) {
                        setMessages(prev => prev.map(msg => 
                            msg && msg.id === currentTranscriptMessageId.current 
                                ? { ...msg, text: fullTranscript }
                                : msg
                        ).filter(msg => msg != null));
                    }
                }

                if (newFinalTranscript.trim()) {
                    finalTranscriptRef.current += newFinalTranscript;
                    lastSpeechTimeRef.current = Date.now();
                    
                    // Clear existing timer
                    if (pauseTimerRef.current) {
                        clearTimeout(pauseTimerRef.current);
                    }
                    
                    // Only start new timer if not already processing and AI isn't speaking
                    if (!isProcessingVoiceRef.current && !isAISpeakingRef.current) {
                        pauseTimerRef.current = setTimeout(() => {
                            if (finalTranscriptRef.current.trim() && 
                                isCallActiveRef.current && 
                                !isProcessingVoiceRef.current && 
                                !isAISpeakingRef.current) {
                                
                                isProcessingVoiceRef.current = true;
                                
                                handleVoiceSend(finalTranscriptRef.current.trim());
                                
                                // Reset everything after processing
                                finalTranscriptRef.current = "";
                                setCurrentTranscript("");
                                
                                // Allow processing again after a short delay
                                setTimeout(() => {
                                    isProcessingVoiceRef.current = false;
                                }, 1000);
                            }
                        }, PAUSE_DURATION);
                    }
                }
                
                if (newFinalTranscript.trim() || interimTranscript.trim()) {
                    lastSpeechTimeRef.current = Date.now();
                }
            };

            recognitionRef.current.onstart = () => {
                setIsListening(true);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
                
                // Only restart if voice mode is active, call is active, and AI is NOT speaking
                if (isVoiceMode && isCallActive && !isAISpeakingRef.current) {
                    setTimeout(() => {
                        if (recognitionRef.current && isVoiceMode && isCallActive && !isAISpeakingRef.current) {
                            try {
                                recognitionRef.current.start();
                            } catch (error) {
                                console.error("Error restarting recognition:", error);
                            }
                        }
                    }, 300); // Longer delay to prevent conflicts
                }
            };

            recognitionRef.current.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                setIsListening(false);
            };
        }

        return () => {
            if (pauseTimerRef.current) {
                clearTimeout(pauseTimerRef.current);
            }
            if (aiSpeakingTimeoutRef.current) {
                clearTimeout(aiSpeakingTimeoutRef.current);
            }
        };
    }, []);

    // Modified useEffect to consider AI speaking state with better timing
    useEffect(() => {
        if (isVoiceMode && isCallActive && recognitionRef.current && !isListening && !isAISpeaking) {
            // Add a small delay before starting recognition after AI stops speaking
            const startDelay = isAISpeaking ? AI_SPEAKING_GRACE_PERIOD + 200 : 100;
            
            const startTimeout = setTimeout(() => {
                if (isVoiceMode && isCallActive && !isAISpeakingRef.current) {
                    try {
                        recognitionRef.current.start();
                    } catch (error) {
                        console.error("Error starting speech recognition:", error);
                    }
                }
            }, startDelay);

            return () => clearTimeout(startTimeout);
        } else if ((!isVoiceMode || isAISpeaking) && recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (error) {
                console.error("Error stopping speech recognition:", error);
            }
            if (pauseTimerRef.current) {
                clearTimeout(pauseTimerRef.current);
            }
        }
    }, [isVoiceMode, isCallActive, isAISpeaking]);

    const handleSend = async () => {
        if (!message.trim() || !managerRef.current) return;

        const userMessage = { 
            id: Date.now(), 
            text: message, 
            sender: "user", 
            animDelay: 0,
            loading: false
        };
        
        setMessages(prev => [...prev, userMessage]);

        // Build chat history from current messages state
        const chatHistory = [...messages, userMessage]
            .filter(msg => msg && !msg.loading && msg.text && !msg.text.includes("...") && msg.sender !== "system")
            .map(msg => `${msg.sender}: ${msg.text}`);

        managerRef.current.SendChatMessage(message, chatHistory);
        setMessage("");
    };

    const handleVoiceSend = (transcript) => {
        if (!transcript.trim() || !managerRef.current) return;
        
        // Check if we have an existing transcript message to update
        if (currentTranscriptMessageId.current) {
            // Update existing transcript message and send
            setMessages(currentMessages => {
                const updatedMessages = currentMessages.map(msg => 
                    msg && msg.id === currentTranscriptMessageId.current 
                        ? { ...msg, text: transcript, isTranscribing: false }
                        : msg
                ).filter(msg => msg != null);

                // Build chat history from the updated messages
                const chatHistory = updatedMessages
                    .filter(msg => msg && !msg.loading && msg.text && !msg.text.includes("...") && msg.sender !== "system" && !msg.loading)
                    .map(msg => `${msg.sender}: ${msg.text}`);

                console.log("Voice chat history:", chatHistory);

                // Send the voice message with proper history
                managerRef.current.SendVoiceMessage(transcript, chatHistory);
                
                return updatedMessages;
            });
            
            // Clear transcript tracking to prevent duplicates
            currentTranscriptMessageId.current = null;
        } else {
            console.warn("No transcript message found to update, this shouldn't happen in normal flow");
        }
    };

    const startCall = () => {
        setIsCallActive(true);
        setIsVoiceMode(true);
        setIsAISpeaking(false);
        isAISpeakingRef.current = false;
        
        if (managerRef.current) {
            managerRef.current.StartCall();
        }

        const systemMessage = {
            id: Date.now(),
            text: "🔊 Voice call started. Speak now...",
            sender: "system",
            animDelay: 0,
            loading: false
        };
        setMessages(prev => [...prev, systemMessage]);
    };

    const endCall = () => {
        setIsCallActive(false);
        setIsVoiceMode(false);
        setIsAISpeaking(false);
        isAISpeakingRef.current = false;
        setCurrentTranscript("");
        currentTranscriptMessageId.current = null;
        finalTranscriptRef.current = "";
        isProcessingVoiceRef.current = false;
        
        if (pauseTimerRef.current) {
            clearTimeout(pauseTimerRef.current);
        }
        if (aiSpeakingTimeoutRef.current) {
            clearTimeout(aiSpeakingTimeoutRef.current);
        }

        const systemMessage = {
            id: Date.now(),
            text: "📞 Voice call ended.",
            sender: "system",
            animDelay: 0,
            loading: false
        };
        setMessages(prev => [...prev, systemMessage]);
    };

    // Create transcript message when speech is first detected (and AI is not speaking)
    useEffect(() => {
        if (currentTranscript && 
            !currentTranscriptMessageId.current && 
            isCallActive && 
            !isProcessingVoiceRef.current && 
            !isAISpeaking) {
            
            const transcriptMessage = {
                id: Date.now(),
                text: currentTranscript,
                sender: "user",
                animDelay: 0,
                loading: false,
                isTranscribing: true
            };
            setMessages(prev => [...prev, transcriptMessage]);
            currentTranscriptMessageId.current = transcriptMessage.id;
        }
    }, [currentTranscript, isCallActive, isAISpeaking]);

    return (
        <div className="w-full h-screen bg-gradient-to-br from-pink-100 via-red-100 to-orange-100 flex justify-end items-end p-6">
        
        <style>{`
            /* Beautiful custom scrollbar for chat container */
            #voice-chat-container::-webkit-scrollbar {
                width: 8px;
            }

            #voice-chat-container::-webkit-scrollbar-track {
                background: rgba(255, 182, 193, 0.2);
                border-radius: 10px;
            }

            #voice-chat-container::-webkit-scrollbar-thumb {
                background: linear-gradient(180deg, #fc8eac, #ff5f6d);
                border-radius: 10px;
                box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.5);
            }

            #voice-chat-container::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(180deg, #ff5f6d, #fc8eac);
            }

            /* For Firefox */
            #voice-chat-container {
                scrollbar-width: thin;
                scrollbar-color: #ff5f6d rgba(255, 182, 193, 0.2);
            }

            @keyframes pulse {
                0%, 100% { transform: scale(0.8); opacity: 0.4; }
                50% { transform: scale(1.2); opacity: 1; }
            }

            @keyframes fade-up {
                0% { opacity: 0; transform: translateY(10px) scale(0.96); }
                100% { opacity: 1; transform: translateY(0) scale(1); }
            }

            @keyframes shimmer {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }

            @keyframes gradient-expand {
                0% { clip-path: circle(0% at 100% 100%); }
                100% { clip-path: circle(150% at 50% 50%); }
            }

            @keyframes gradient-shrink {
                0% { clip-path: circle(150% at 50% 50%); }
                100% { clip-path: circle(0% at 100% 100%); }
            }

            @keyframes thinking-dot-pop {
                0%, 80%, 100% {
                    transform: translateY(0) scale(1);
                    opacity: 0.4;
                }
                40% {
                    transform: translateY(-4px) scale(1.2);
                    opacity: 1;
                }
            }

            @keyframes bubble-pop {
                0% {
                    opacity: 0;
                    transform: translateY(12px) scale(0.8);
                    filter: blur(2px);
                }
                60% {
                    opacity: 1;
                    transform: translateY(-2px) scale(1.02);
                    filter: blur(0);
                }
                100% {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            @keyframes pulse-glow {
                0%, 100% { box-shadow: 0 4px 20px rgba(252, 165, 165, 0.4); }
                50% { box-shadow: 0 8px 30px rgba(252, 165, 165, 0.6); }
            }

            @keyframes recording-pulse {
                0%, 100% { 
                    transform: scale(1);
                    box-shadow: 0 0 20px rgba(239, 68, 68, 0.4);
                }
                50% { 
                    transform: scale(1.05);
                    box-shadow: 0 0 30px rgba(239, 68, 68, 0.8);
                }
            }




            @keyframes typing-cursor {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            /* Chat container - optimized for free scrolling */
            #voice-chat-container {
                overflow-x: hidden !important;
                overflow-y: auto !important;
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                scroll-behavior: smooth;
                will-change: scroll-position;
                -webkit-overflow-scrolling: touch;
            }

            /* Message bubbles - independent sizing */
            .message-bubble {
                display: inline-block;
                padding: 8px 12px;
                border-radius: 16px;
                max-width: 280px;
                width: auto;
                min-height: auto;
                box-sizing: border-box;
                word-wrap: break-word;
                word-break: break-word;
                overflow-wrap: break-word;
                hyphens: auto;
                line-height: 1.4;
                contain: layout style;
            }

            /* Message rows - clean flex layout */
            .message-row {
                display: flex;
                width: 100%;
                margin-bottom: 8px;
                box-sizing: border-box;
                flex-shrink: 0;
                min-height: auto;
            }

            .message-row.ai {
                justify-content: flex-start;
            }

            .message-row.user {
                justify-content: flex-end;
            }

            .message-row.system {
                justify-content: center;
            }
        `}</style>
            
            <div ref={dragRef} style={{ position: "relative", willChange: "transform" }} className="z-10">
                {/* Floating Chat Button */}
                <button
                    onClick={() => setChatOpen(!chatOpen)}
                    className={`w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-red-400 flex items-center justify-center 
                               shadow-lg hover:scale-110 cursor-pointer hover:shadow-2xl transition-transform duration-300 relative
                               ${isCallActive ? 'animate-[recording-pulse_1s_infinite]' : 'animate-[pulse-glow_2s_infinite]'}`}
                >
                    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                        <path d="m26 32h-20c-3.314 0-6-2.686-6-6v-20c0-3.314 2.686-6 6-6h20c3.314 0 6 2.686 6 6v20c0 3.314-2.686 6-6 6z" fill="#ffe6e2" />
                        <path d="m16 11.333c-4.71 0-8 1.493-8 3.63 0 2.139 5.595 2.37 8 2.37s8-.231 8-2.37c0-2.137-3.29-3.63-8-3.63z" fill="#fc573b" />
                    </svg>
                    <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                        isCallActive ? 'bg-red-500 animate-pulse' : isConnected ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                </button>

                {/* Assistant Panel */}
                <div
                    ref={assistantRef}
                    style={{ width: ASSISTANT_WIDTH, height: ASSISTANT_HEIGHT }}
                    className={`absolute border bottom-16 flex flex-col right-0 overflow-hidden rounded-2xl shadow-2xl
                                backdrop-blur-xl bg-white/40 transform transition-all duration-500 ease-out origin-bottom-right box-border
                                ${chatOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4 pointer-events-none"}
                                ${isVoiceMode ? "border-transparent" : "border-pink-200"}`}
                >
                    {/* Gradient overlay for voice mode */}
                    <div
                        className={`absolute inset-0 z-0 bg-gradient-to-br from-pink-400 to-red-400 transition-all duration-700
                                    ${isVoiceMode ? "animate-[gradient-expand_0.6s_ease_forwards]" : "animate-[gradient-shrink_0.6s_ease_forwards]"}`}
                    ></div>

                    {/* Header */}
                    <div
                        className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/30 
                                   bg-gradient-to-r from-pink-500/80 to-red-500/80 backdrop-blur-lg
                                   bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] flex-shrink-0"
                    >
                        <h2 className="text-lg font-semibold text-white drop-shadow">
                            AI Assistant {isCallActive ? (isAISpeaking ? "(AI Speaking...)" : "(Listening...)") : !isConnected ? "(Connecting...)" : ""}
                        </h2>
                        <button onClick={() => setChatOpen(false)} className="text-white hover:text-yellow-200 transition-colors text-xl">✕</button>
                    </div>

                    {/* Chat Messages */}
                    <div
                        ref={chatContainerRef}
                        id="voice-chat-container"
                        className="relative z-10 flex-1 px-4 py-3"
                        style={{ 
                            minHeight: 0,
                            maxHeight: 'calc(100% - 120px)',
                            overflowY: 'auto',
                            overflowX: 'hidden'
                        }}
                    >
                        {messages.filter(msg => msg != null).map((msg, i) => (
                            <div
                                key={msg.id}
                                className={`message-row ${msg.sender}`}
                                style={{
                                    animation: `bubble-pop 0.4s cubic-bezier(0.25, 1.25, 0.5, 1) forwards`,
                                    animationDelay: `${i * 0.03}s`,
                                    opacity: 0
                                }}
                            >
                                <div
                                    className={`message-bubble ${
                                        msg.sender === "ai"
                                            ? "bg-white/70 text-pink-700"
                                            : msg.sender === "system"
                                            ? "bg-blue-200/70 text-blue-800 text-sm max-w-[200px]"
                                            : "bg-gradient-to-r from-pink-400 to-red-400 text-white shadow-md"
                                    } ${msg.loading ? 'transcribing' : ''}`}
                                >
                                    {msg.loading ? (
                                        <span className="flex items-center gap-[4px]">
                                            {[0, 1, 2].map(dot => (
                                                <span
                                                    key={dot}
                                                    style={{
                                                        animation: `thinking-dot-pop 1.2s ease-in-out ${dot * 0.2}s infinite`
                                                    }}
                                                    className="w-[6px] h-[6px] rounded-full bg-pink-400"
                                                ></span>
                                            ))}
                                        </span>
                                    ) : (
                                        <span className="block">{msg.text}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Controls */}
                    <div className="relative z-10 flex items-center gap-2 px-4 py-3 border-t border-white/30 overflow-hidden min-h-[60px] flex-shrink-0">
                        {/* Text Mode Controls */}
                        <div
                            className={`absolute inset-0 flex items-center gap-2 px-4 transition-all duration-300
                                        ${isVoiceMode ? "opacity-0 translate-y-2 pointer-events-none" : "opacity-100 translate-y-0"}`}
                        >
                            <button
                                onClick={startCall}
                                disabled={!isConnected}
                                className="p-2 rounded-full hover:bg-white/40 transition-colors disabled:opacity-50 flex-shrink-0"
                                title="Start voice call"
                            >
                                <IoCall className="text-green-600 text-xl" />
                            </button>
                            <input
                                type="text"
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                placeholder={isConnected ? "Type a message..." : "Connecting..."}
                                disabled={!isConnected}
                                className="flex-1 px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm placeholder-pink-400 text-pink-700 outline-none focus:ring-2 focus:ring-pink-300 disabled:opacity-50 min-w-0"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!isConnected || !message.trim()}
                                className="p-2 rounded-full bg-gradient-to-br from-pink-400 to-red-400 text-white hover:scale-105 transition-transform shadow-md disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
                            >
                                <IoSend />
                            </button>
                        </div>

                        {/* Voice Mode Controls */}
                        <div
                            className={`absolute inset-0 flex items-center justify-center gap-4 px-4 transition-all duration-300
                                        ${isVoiceMode ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}
                        >
                            <div className="flex items-center gap-2 text-white">
                                <div className={`w-3 h-3 rounded-full ${
                                    isAISpeaking ? 'bg-blue-400 animate-pulse' : 
                                    isListening ? 'bg-red-400 animate-pulse' : 'bg-gray-400'
                                }`}></div>
                                <span className="text-sm">
                                    {isAISpeaking ? "AI Speaking..." : 
                                     isListening ? "Listening..." : "Voice Ready"}
                                </span>
                            </div>
                            <button
                                onClick={endCall}
                                className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors text-white"
                            >
                                <IoCallSharp className="text-xl rotate-135" />
                                <span className="text-sm">End Call</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}