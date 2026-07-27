import React, { useState, useEffect, useRef } from "react";
import { api } from "../lib/api";
import { ChatMessage } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, Send, Mic, MicOff, RefreshCw, 
  User, Bot, Flame, Compass, BrainCircuit 
} from "lucide-react";

export default function CoachScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState("Listening...");
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const hist = await api.getCoachHistory();
      setMessages(hist);
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  const scrollToBottom = () => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input;
    setInput("");
    setLoading(true);

    // Optimistic user update
    const tempUserMsg: ChatMessage = {
      id: `temp-u-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const res = await api.sendCoachMessage(userText);
      setMessages(res.history);
    } catch (err) {
      console.error("Chat send failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Real Web Speech API voice input with graceful fallback
  const handleVoiceInput = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    // Check for native browser speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // No speech API available — inform user
      setRecordingText("Voice input not supported in this browser. Please type your message.");
      setIsRecording(true);
      setTimeout(() => setIsRecording(false), 3000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsRecording(true);
    setRecordingText("Listening...");

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.warn("Speech recognition error:", event.error);
      setRecordingText("Could not capture audio. Please type your message.");
      setTimeout(() => setIsRecording(false), 2500);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handlePreloadedPrompt = (promptText: string) => {
    setInput(promptText);
  };

  return (
    <div className="glass-card rounded-2xl flex flex-col h-[calc(100vh-12rem)] min-h-[480px] overflow-hidden relative">
      
      {/* Coach Chat Header */}
      <div className="p-4 border-b border-theme-border bg-theme-active-nav/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center glow-primary shadow-lg shadow-indigo-500/20">
            <Bot className="w-5 h-5 text-white animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="font-extrabold text-theme-text-main text-sm">Socrates-Focus</h3>
              <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                Active Coach
              </span>
            </div>
            <p className="text-[10px] text-theme-text-muted">Philosophical & Empathetic Productivity Architect</p>
          </div>
        </div>

        <button 
          onClick={fetchHistory}
          className="text-theme-text-muted hover:text-theme-text-main p-2 rounded-lg hover:bg-theme-active-nav transition-all cursor-pointer"
          title="Clear History / Fetch history"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Message Area */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-theme-active-nav/10">
        
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <BrainCircuit className="w-12 h-12 text-indigo-500 mb-4 animate-pulse" />
            <h4 className="text-base font-bold text-theme-text-main mb-2">Initiate Mindset Calibration</h4>
            <p className="text-xs text-theme-text-muted max-w-sm leading-relaxed mb-6">
              I am Socrates-Focus. Ask me to break down massive assignments, plan your limited hours, pair habits, or help alleviate study anxiety.
            </p>

            {/* Quick Prompts Bento Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md w-full">
              {[
                { label: "I feel overwhelmed", desc: "Strategy to clear cognitive anxiety.", phrase: "I feel completely overwhelmed by my upcoming deadlines, help me break them down." },
                { label: "I only have 2 hours today", desc: "Optimize critical output path.", phrase: "I have an exam in 2 days but only have 2 free hours today. Schedule me." },
                { label: "Pair meditation habit", desc: "Build neurological anchors.", phrase: "Suggest how I can pair diaphragmatic breathing meditation into my busy hackathon schedule." },
                { label: "Create focus blocks", desc: "Plan deep work blocks.", phrase: "Help me create high-intensity 90-minute focus sessions around my standup meetings." }
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handlePreloadedPrompt(item.phrase)}
                  className="p-3 text-left bg-theme-input-bg/60 border border-theme-border hover:border-indigo-500/40 rounded-xl transition-all cursor-pointer"
                >
                  <span className="block text-xs font-bold text-indigo-500 mb-0.5">{item.label}</span>
                  <span className="text-[10px] text-theme-text-muted leading-snug">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isUser = m.role === 'user';
            return (
              <motion.div
                key={m.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Profile Circle */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  isUser 
                    ? 'bg-theme-input-bg border-theme-border text-indigo-500' 
                    : 'bg-indigo-950/20 border-indigo-500/20 text-indigo-500'
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div className={`rounded-2xl p-4 text-xs leading-relaxed border ${
                  isUser 
                    ? 'bg-indigo-500/10 border-indigo-500/15 text-theme-text-main rounded-tr-none' 
                    : 'bg-theme-input-bg/80 border-theme-border text-theme-text-main rounded-tl-none font-sans'
                }`}>
                  {/* Clean line breaking formatting for bullet points */}
                  <div className="whitespace-pre-line space-y-2">
                    {m.content}
                  </div>
                  <span className="block text-[8px] text-theme-text-muted font-mono text-right mt-2">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 mr-auto max-w-[85%]">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border bg-indigo-950/20 border-indigo-500/20 text-indigo-500">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="rounded-2xl p-4 bg-theme-input-bg border border-theme-border rounded-tl-none text-xs text-theme-text-muted">
              <div className="flex items-center gap-1.5 font-mono">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="text-[10px] text-theme-text-muted ml-1">Socrates is pondering...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={threadEndRef} />
      </div>

      {/* Speech assistant indicator */}
      <AnimatePresence>
        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="absolute inset-x-0 bottom-18 bg-theme-bg border-t border-theme-border p-4 flex items-center justify-between text-indigo-500 z-10"
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping" />
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                  <Mic className="w-4 h-4 animate-pulse" />
                </div>
              </div>
              <span className="text-xs font-semibold animate-pulse">{recordingText}</span>
            </div>
            <button 
              onClick={() => setIsRecording(false)}
              className="text-xs text-red-500 hover:underline cursor-pointer font-bold"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Bar */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-theme-border bg-theme-active-nav/40 flex items-center gap-2">
        {/* Simulated speech trigger */}
        <button
          type="button"
          onClick={handleVoiceInput}
          className={`p-2.5 rounded-xl border flex items-center justify-center cursor-pointer transition-all ${
            isRecording 
              ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse' 
              : 'bg-theme-input-bg border-theme-border text-theme-text-muted hover:text-indigo-500 hover:border-indigo-500/30'
          }`}
          title="Voice Input (requires browser microphone permission)"
        >
          <Mic className="w-5 h-5" />
        </button>

        <input
          type="text"
          placeholder="Formulate query to Socrates-Focus productivity coach..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-xl py-2.5 px-4 text-xs text-theme-text-main placeholder-theme-text-muted/60 transition-colors"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          aria-label="Send message"
          className="p-2.5 bg-indigo-500 hover:bg-indigo-600 active:scale-95 disabled:opacity-50 disabled:scale-100 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 cursor-pointer transition-all"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>

    </div>
  );
}
