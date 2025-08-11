
export class AudioManager {
    MIN_BUFFER_SIZE = 1;
    RESUME_BUFFER_SIZE = 1;
    CONCAT_CHUNK_SIZE = 2;
    TARGET_CHUNK_DURATION = 0.5;
    
    CHANNELS = 1;
    SAMPLE_RATE = 16000;

    pcm_data_pending_buffer: Array<Int16Array>;
    AudioQueue: Array<AudioBuffer>;
    isBuffering: boolean;
    isPlaying: boolean = false;
    hasStarted: boolean = false;
    AudioCtx: AudioContext;
    nextPlayTime: number;

    // New properties for complete audio collection
    allReceivedChunks: Array<Int16Array> = []; // Store ALL chunks received
    isStreamComplete: boolean = false;
    onStreamComplete?: (completeAudio: AudioBuffer) => void; // Callback when done
    onVoiceComplete:()=>void
    streamStartTime: number = 0;
    streamEndTime: number = 0;

    constructor() {
        this.pcm_data_pending_buffer = [];
        this.AudioQueue = [];
        this.isBuffering = true;
        this.nextPlayTime = 0;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.AudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.allReceivedChunks = [];
    }

    // Main method - now returns Promise<AudioBuffer> when streaming completes
    AddandPlay(chunk: ArrayBuffer): void {
        const pcm_array = new Int16Array(chunk);
        
        // Store this chunk for final complete audio
        this.allReceivedChunks.push(pcm_array);
        
        // Set start time on first chunk
        if (this.allReceivedChunks.length === 1) {
            this.streamStartTime = Date.now();
            console.log("🎬 Stream started");
        }
        
        // Add to pending buffer for live playback
        this.pcm_data_pending_buffer.push(pcm_array);

        // Handle concatenation for live playback
        if (this._shldConcatenateChunks()) {
            const concatenatedChunk = this._ConcatenateChunks();
            if (concatenatedChunk) {
                this.AudioQueue.push(concatenatedChunk);
                console.log(`📦 Added concatenated chunk, queue size: ${this.AudioQueue.length}`);
            }
        }

        // Live playback logic (same as before)
        if (this.isBuffering && this.AudioQueue.length >= this.MIN_BUFFER_SIZE) {
            console.log("🎵 Starting buffered playback (INITIAL START)");
            this.isBuffering = false;
            this.isPlaying = true;
            this.hasStarted = true;
            this.nextPlayTime = this.AudioCtx.currentTime ;
            this._scheduleNext();
        }
        else if (this.hasStarted && !this.isPlaying && this.AudioQueue.length >= this.RESUME_BUFFER_SIZE) {
            console.log("▶️ Resuming playback");
            this.isPlaying = true;
            
            const currentTime = this.AudioCtx.currentTime;
            if (this.nextPlayTime < currentTime) {
                this.nextPlayTime = currentTime ;
            }
            
            this._scheduleNext();
        }
    }

    // Call this when streaming is complete
    finishStream(): AudioBuffer {
        this.isStreamComplete = true;
        this.streamEndTime = Date.now();
        
        console.log(`🏁 Stream completed - received ${this.allReceivedChunks.length} chunks in ${this.streamEndTime - this.streamStartTime}ms`);
        
        // Process any remaining pending chunks for live playback
        if (this.pcm_data_pending_buffer.length > 0) {
            const finalChunk = this._ConcatenateChunks();
            if (finalChunk) {
                this.AudioQueue.push(finalChunk);
                if (!this.isPlaying) {
                    this.isPlaying = true;
                    this.nextPlayTime = Math.max(this.nextPlayTime, this.AudioCtx.currentTime );
                    this._scheduleNext();
                }
            }
        }
        
        // Create complete audio from all received chunks
        const completeAudio = this._createCompleteAudioBuffer();
        
        // Trigger callback if set
        if (this.onStreamComplete) {
            this.onStreamComplete(completeAudio);
        }
        
        return completeAudio;
    }

    // Create complete audio buffer from all received chunks
    _createCompleteAudioBuffer(): AudioBuffer {
        if (this.allReceivedChunks.length === 0) {
            throw new Error("No audio chunks received");
        }

        console.log(`🔗 Creating complete audio from ${this.allReceivedChunks.length} chunks`);
        
        // Concatenate all chunks
        const completeData = this._ConcatenateInt16Arrays(this.allReceivedChunks);
        const completeAudioBuffer = this._CreateAudioBufferFromPCM(completeData);
        
        console.log(`✅ Complete audio created: ${completeAudioBuffer.duration.toFixed(2)}s duration`);
        
        return completeAudioBuffer;
    }

    // Get complete audio as various formats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getCompleteAudioAs(format: 'wav' | 'blob' | 'base64' | 'buffer'): Promise<any> {
        if (!this.isStreamComplete) {
            throw new Error("Stream not yet complete. Call finishStream() first.");
        }

        const completeAudio = this._createCompleteAudioBuffer();

        switch (format) {
            case 'wav':
                return this._audioBufferToWAV(completeAudio);
            case 'blob':
                return this._audioBufferToBlob(completeAudio);
            case 'base64':
                return this._arrayBufferToBase64(this._audioBufferToWAV(completeAudio));
            case 'buffer':
            default:
                return completeAudio;
        }
    }

    // Convert AudioBuffer to WAV format
    _audioBufferToWAV(audioBuffer: AudioBuffer): ArrayBuffer {
        const length = audioBuffer.length;
        const buffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(buffer);
        const channelData = audioBuffer.getChannelData(0);

        // WAV header
        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, this.SAMPLE_RATE, true);
        view.setUint32(28, this.SAMPLE_RATE * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);

        // Convert float32 to int16 and write
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }

        return buffer;
    }

    // Convert AudioBuffer to Blob
    _audioBufferToBlob(audioBuffer: AudioBuffer): Blob {
        const wavBuffer = this._audioBufferToWAV(audioBuffer);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    // Convert ArrayBuffer to Base64
    _arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    // Download complete audio as file
    downloadCompleteAudio(filename: string = 'complete_audio.wav'): void {
        if (!this.isStreamComplete) {
            console.error("Stream not complete yet!");
            return;
        }

        const completeAudio = this._createCompleteAudioBuffer();
        const blob = this._audioBufferToBlob(completeAudio);
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`💾 Downloaded complete audio as ${filename}`);
    }

    // Existing methods (same as before)
    _scheduleNext() {
        if (this.AudioQueue.length === 0) {
            console.log("📭 Queue empty, stopping playback");
            this.isPlaying = false;
            return;
        }

        const chunk = this.AudioQueue.shift()!;
        const source = this.AudioCtx.createBufferSource();
        source.buffer = chunk;
        source.connect(this.AudioCtx.destination);

        const currentTime = this.AudioCtx.currentTime;
        if (this.nextPlayTime < currentTime) {
            this.nextPlayTime = currentTime;
        }

        source.start(this.nextPlayTime);
        console.log(`🎵 Playing at ${this.nextPlayTime.toFixed(3)}s, duration: ${chunk.duration.toFixed(3)}s`);
        
        this.nextPlayTime += chunk.duration;

        source.onended = () => {
            if (this.AudioQueue.length > 0) {
                this._scheduleNext();
            } else {
                if (this.pcm_data_pending_buffer.length > 0) {
                    const finalChunk = this._ConcatenateChunks();
                    if (finalChunk) {
                        this.AudioQueue.push(finalChunk);
                        this._scheduleNext();
                        return;
                    }
                }
                this.onVoiceComplete()
                console.log("⏹️ Live playback finished");
                this.isPlaying = false;
            }
        };
    }

    _shldConcatenateChunks(): boolean {
        if (this.pcm_data_pending_buffer.length === 0) return false;
        return this.pcm_data_pending_buffer.length >= this.CONCAT_CHUNK_SIZE || 
               this.pcm_data_pending_buffer.reduce((total, chunk) => total + (chunk.length / this.SAMPLE_RATE), 0) >= this.TARGET_CHUNK_DURATION;
    }

    _ConcatenateChunks(): AudioBuffer | null {
        if (this.pcm_data_pending_buffer.length === 0) return null;

        try {
            const concatenatedChunk = this._ConcatenateInt16Arrays(this.pcm_data_pending_buffer);
            const audioBuffer = this._CreateAudioBufferFromPCM(concatenatedChunk);
            
            this.pcm_data_pending_buffer = [];
            return audioBuffer;
        } catch (error) {
            console.error("❌ Error concatenating chunks:", error);
            this.pcm_data_pending_buffer = [];
            return null;
        }
    }

    _ConcatenateInt16Arrays(arrays: Array<Int16Array>): Int16Array {
        const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const result = new Int16Array(totalLength);
        let offset = 0;
        
        for (const arr of arrays) {
            result.set(arr, offset);
            offset += arr.length;
        }
        
        return result;
    }

    _CreateAudioBufferFromPCM(pcmData: Int16Array): AudioBuffer {
        const sampleCount = pcmData.length;
        const audioBuffer = this.AudioCtx.createBuffer(this.CHANNELS, sampleCount, this.SAMPLE_RATE);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < sampleCount; i++) {
            channelData[i] = pcmData[i] / 32768.0;
        }
        
        return audioBuffer;
    }

    // Reset for new session
    resetSession() {
        console.log("🔄 Resetting AudioManager session");
        this.isBuffering = true;
        this.isPlaying = false;
        this.hasStarted = false;
        this.isStreamComplete = false;
        this.AudioQueue = [];
        this.pcm_data_pending_buffer = [];
        this.allReceivedChunks = []; // Clear complete audio collection
        this.nextPlayTime = 0;
        this.streamStartTime = 0;
        this.streamEndTime = 0;
    }

    // Get streaming statistics
    getStats() {
        const totalDuration = this.allReceivedChunks.reduce((sum, chunk) => 
            sum + (chunk.length / this.SAMPLE_RATE), 0
        );
        
        return {
            totalChunks: this.allReceivedChunks.length,
            totalDuration: totalDuration,
            streamDuration: this.streamEndTime - this.streamStartTime,
            isComplete: this.isStreamComplete,
            averageChunkSize: this.allReceivedChunks.length > 0 ? 
                this.allReceivedChunks.reduce((sum, chunk) => sum + chunk.length, 0) / this.allReceivedChunks.length : 0
        };
    }
}

// Usage example:
/*
const audioManager = new AudioManager();

// Set callback for when streaming completes
audioManager.onStreamComplete = (completeAudio) => {
    console.log("Stream complete! Audio duration:", completeAudio.duration.toFixed(2), "seconds");
    // Do something with complete audio
};

// During streaming
websocket.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
        audioManager.AddandPlay(event.data); // Live playback continues
    }
};

// When streaming ends
websocket.onclose = () => {
    const completeAudio = audioManager.finishStream(); // Returns complete AudioBuffer
    
    // Get in different formats
    audioManager.getCompleteAudioAs('wav').then(wavBuffer => {
        // Use WAV data
    });
    
    audioManager.getCompleteAudioAs('blob').then(blob => {
        // Use Blob for uploading
    });
    
    // Download as file
    audioManager.downloadCompleteAudio('my_conversation.wav');
    
    // Get stats
    console.log(audioManager.getStats());
};
*/