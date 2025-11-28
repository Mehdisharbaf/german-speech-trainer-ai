import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob } from '../utils/audioUtils';
import { Turn, ConnectionState } from '../types';

// System instruction for the separate text-analysis step
const FEEDBACK_SYSTEM_INSTRUCTION = `
You are a strict German language tutor. 
Your task is to analyze the German text provided by the user. 
The user will provide a full paragraph of speech.

Output strictly in this format:

Feedback:
- Error explanation (English): [Brief explanation of grammar/vocab error]
- Corrected version (German): [Correct German sentence/paragraph]
- Improved natural version (German): [C1-level native phrasing]

If the text is correct, say "Correct text" in the explanation and provide an improved native version.
Do not output the original transcript again.
`;

// System instruction for the Live API (ASR only)
const LIVE_API_SYSTEM_INSTRUCTION = `
You are a passive transcriber. 
Do not speak. 
Do not reply to the user. 
Just listen and transcribe.
`;

export const useGeminiLive = () => {
  const [status, setStatus] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [audioAnalyser, setAudioAnalyser] = useState<AnalyserNode | undefined>(undefined);

  // Refs for persistent objects across renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Ref to hold the active Gemini Session so we can close it properly
  const activeSessionRef = useRef<any>(null);
  
  // State refs to avoid stale closures in event handlers
  const currentTurnIdRef = useRef<string | null>(null);
  const currentInputTransRef = useRef<string>('');
  
  // Debounce timer ref
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Helper to safely update turns state
  const updateTurn = useCallback((id: string, updates: Partial<Turn>) => {
    setTurns(prev => {
      const index = prev.findIndex(t => t.id === id);
      if (index === -1) return prev;
      
      const newTurns = [...prev];
      newTurns[index] = { ...newTurns[index], ...updates };
      return newTurns;
    });
  }, []);

  const createTurn = useCallback((id: string) => {
    setTurns(prev => [...prev, {
      id,
      userTranscript: '',
      modelResponse: '',
      isComplete: false,
      timestamp: Date.now()
    }]);
  }, []);

  const disconnect = useCallback(async () => {
    console.log("Disconnecting session...");
    
    // 1. Clear timers
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // 2. Close Gemini Session
    if (activeSessionRef.current) {
      try {
        await activeSessionRef.current.close();
        console.log("Gemini session closed.");
      } catch (error) {
        console.error("Error closing Gemini session:", error);
      }
      activeSessionRef.current = null;
    }

    // 3. Stop Microphone Stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // 4. Disconnect Audio Nodes
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // 5. Close Audio Context
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          await audioContextRef.current.close();
        }
      } catch (error) {
        console.error("Error closing audio context:", error);
      }
      audioContextRef.current = null;
    }
    
    // 6. Reset Internal State
    setStatus(ConnectionState.DISCONNECTED);
    setAudioAnalyser(undefined);
    currentTurnIdRef.current = null;
    currentInputTransRef.current = '';
  }, []);

  // Function to fetch grammar feedback using standard GenerateContent
  const fetchGrammarFeedback = useCallback(async (text: string, turnId: string) => {
    if (!process.env.API_KEY || !text.trim()) return;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
          systemInstruction: FEEDBACK_SYSTEM_INSTRUCTION,
        }
      });

      const feedback = response.text;
      console.log("GRAMMAR FEEDBACK:", feedback);

      if (feedback) {
        updateTurn(turnId, { 
          modelResponse: feedback,
          isComplete: true 
        });
      }
    } catch (error) {
      console.error("Error fetching feedback:", error);
      updateTurn(turnId, { 
        modelResponse: "Error generating feedback. Please try again.",
        isComplete: true 
      });
    }
  }, [updateTurn]);

  const connect = useCallback(async () => {
    if (!process.env.API_KEY) {
      alert("API Key not found in environment variables.");
      return;
    }

    try {
      console.log("Starting new session...");
      setStatus(ConnectionState.CONNECTING);
      
      // Initialize Audio Context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, 
      });
      await audioContext.resume();
      audioContextRef.current = audioContext;

      // Initialize Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;
      
      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      setAudioAnalyser(analyser);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          inputAudioTranscription: {}, // Explicitly request transcription
          outputAudioTranscription: {},
          systemInstruction: LIVE_API_SYSTEM_INSTRUCTION,
        },
        callbacks: {
          onopen: () => {
            console.log("Session connected.");
            setStatus(ConnectionState.CONNECTED);
            const actualSampleRate = audioContext.sampleRate;

            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              // Safety check: don't process if disconnected
              if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;

              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData, actualSampleRate);
              
              sessionPromise.then(session => {
                 // Double check session matches active one
                 if (activeSessionRef.current === session) {
                    session.sendRealtimeInput({ media: pcmBlob });
                 }
              });
            };
            
            // Connect audio graph
            // Source -> Analyser -> Processor -> Destination (mute)
            // Note: Processor needs to connect to destination to fire events
            const gainNode = audioContext.createGain();
            gainNode.gain.value = 0; 
            
            source.connect(processor);
            processor.connect(gainNode);
            gainNode.connect(audioContext.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle User Transcription
            const inputTxt = message.serverContent?.inputTranscription?.text;
            
            if (inputTxt) {
              // 1. Clear existing silence timer because user is speaking
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
              }

              // 2. Start a new turn if we don't have one active
              if (!currentTurnIdRef.current) {
                const newId = Date.now().toString();
                currentTurnIdRef.current = newId;
                currentInputTransRef.current = '';
                createTurn(newId);
                console.log("Started new paragraph turn:", newId);
              }

              // 3. Accumulate transcript - Wait for full paragraph
              currentInputTransRef.current += inputTxt;
              
              // 4. Set debounce timer to finalize turn after LONG silence (3 seconds for paragraphs)
              silenceTimerRef.current = setTimeout(() => {
                const finalTranscript = currentInputTransRef.current;
                const turnId = currentTurnIdRef.current;

                if (turnId && finalTranscript.trim()) {
                  // Finalize current turn:
                  // 1. Show the final full transcript
                  console.log(`FINAL PARAGRAPH TRANSCRIPT: "${finalTranscript}"`);
                  updateTurn(turnId, { 
                    userTranscript: finalTranscript 
                  });
                  
                  // 2. Trigger feedback generation
                  fetchGrammarFeedback(finalTranscript, turnId);
                  
                  // 3. Reset state for next paragraph
                  currentTurnIdRef.current = null;
                  currentInputTransRef.current = '';
                }
              }, 3000); // 3.0 second silence threshold for paragraphs
            }
          },
          onclose: () => {
            console.log("Session closed by server");
            // Only disconnect if we didn't initiate it (to avoid loops)
            if (activeSessionRef.current) {
                disconnect();
            }
          },
          onerror: (err) => {
            console.error("Session error:", err);
            disconnect();
            setStatus(ConnectionState.ERROR);
          }
        }
      });
      
      // Store the active session to allow cleanup
      sessionPromise.then(session => {
          activeSessionRef.current = session;
      });

    } catch (error) {
      console.error("Connection failed:", error);
      disconnect();
      setStatus(ConnectionState.ERROR);
    }
  }, [disconnect, createTurn, updateTurn, fetchGrammarFeedback]);

  return {
    connect,
    disconnect,
    status,
    turns,
    audioAnalyser
  };
};