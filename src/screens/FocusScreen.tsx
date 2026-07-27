import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { 
  Play, Pause, RotateCcw, Shield, ShieldAlert, ShieldCheck, 
  CheckCircle2, Coffee, Timer, Smile, Wind, Trash2, Plus 
} from "lucide-react";

export default function FocusScreen() {
  const { user } = useAuth();
  const defaultFocusMinutes = user?.focusPeriod || 25;

  // Pomodoro states
  const [minutes, setMinutes] = useState(defaultFocusMinutes);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  // Website blocker state — persisted in component state (visual only — actual OS blocking requires extensions)
  const [distractions, setDistractions] = useState<string[]>([
    "youtube.com", "twitter.com", "reddit.com", "facebook.com"
  ]);
  const [newSite, setNewSite] = useState("");
  const [shieldActive, setShieldActive] = useState(true);

  // Breathing helper states
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<"In" | "Hold" | "Out">("In");
  const [breathCount, setBreathCount] = useState(4);

  // Pomodoro Core loop
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive) {
      interval = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            handleTimerComplete();
          } else {
            setMinutes(prev => prev - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(prev => prev - 1);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, seconds, minutes]);

  // Breathing guide loop
  useEffect(() => {
    let breathInterval: NodeJS.Timeout | null = null;
    if (breathingActive) {
      breathInterval = setInterval(() => {
        setBreathCount(prev => {
          if (prev === 1) {
            setBreathPhase(curr => {
              if (curr === "In") return "Hold";
              if (curr === "Hold") return "Out";
              return "In";
            });
            return 4;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (breathInterval) clearInterval(breathInterval);
    };
  }, [breathingActive, breathPhase]);

  const handleTimerComplete = async () => {
    setIsActive(false);
    if (mode === "focus") {
      // Record the completed focus session in analytics
      try {
        await api.recordFocusSession(defaultFocusMinutes);
      } catch (err) {
        console.error("Failed to record focus session:", err);
      }
      setMode("break");
      setMinutes(5);
      setSeconds(0);
      setCompletionMessage(`Focus session complete! ${defaultFocusMinutes} minutes logged. Take a 5-minute breathing break.`);
    } else {
      setMode("focus");
      setMinutes(defaultFocusMinutes);
      setSeconds(0);
      setCompletionMessage("Break complete. Ready for your next focus block!");
    }
    setTimeout(() => setCompletionMessage(null), 5000);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    if (completionMessage) setCompletionMessage(null);
  };

  const resetTimer = () => {
    setIsActive(false);
    setMode("focus");
    setMinutes(defaultFocusMinutes);
    setSeconds(0);
    setCompletionMessage(null);
  };

  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSite.trim().toLowerCase();
    if (!trimmed) return;
    if (!distractions.includes(trimmed)) {
      setDistractions(prev => [...prev, trimmed]);
    }
    setNewSite("");
  };

  const handleRemoveSite = (site: string) => {
    setDistractions(prev => prev.filter(s => s !== site));
  };

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      
      {/* Left side: Pomodoro Timer */}
      <div className="lg:col-span-7 flex flex-col">
        <div className="glass-card rounded-xl p-8 flex flex-col items-center justify-center text-center h-full relative overflow-hidden">
          
          <div className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-500 text-[10px] font-bold">
            <Timer className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">{mode === 'focus' ? 'Active Focus Block' : 'Relaxation Block'}</span>
          </div>

          {/* Completion feedback banner (replaces alert()) */}
          <AnimatePresence>
            {completionMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-14 left-4 right-4 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-emerald-400 font-semibold"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{completionMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Visual Timer Progress Circle */}
          <div className="w-56 h-56 rounded-full border-4 border-theme-border flex flex-col items-center justify-center relative my-6 glow-primary border-t-indigo-500/70 border-r-indigo-500/40">
            <span className="text-4xl font-black text-theme-text-main font-mono tracking-wider">
              {formattedTime}
            </span>
            <span className="text-[10px] uppercase font-bold text-theme-text-muted tracking-widest mt-1">
              {mode === 'focus' ? 'Deep Work' : 'Break Time'}
            </span>
          </div>

          {/* Controls bar */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={resetTimer}
              className="p-3 bg-theme-input-bg border border-theme-border hover:text-theme-text-main rounded-xl text-theme-text-muted hover:bg-theme-active-nav active:scale-95 transition-all cursor-pointer"
              title="Reset Session"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <button
              onClick={toggleTimer}
              className={`px-8 py-3 rounded-xl font-bold text-sm text-white flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-lg ${
                isActive 
                  ? "bg-theme-input-bg border border-theme-border text-theme-text-main hover:bg-theme-active-nav" 
                  : "bg-gradient-to-r from-indigo-500 to-violet-600 shadow-indigo-500/20"
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="w-4.5 h-4.5" />
                  <span>Pause Timer</span>
                </>
              ) : (
                <>
                  <Play className="w-4.5 h-4.5" />
                  <span>Initiate Focus</span>
                </>
              )}
            </button>
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={() => { setMinutes(defaultFocusMinutes); setSeconds(0); setMode("focus"); setIsActive(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${mode === 'focus' && minutes === defaultFocusMinutes ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-theme-text-muted hover:text-theme-text-main'}`}
            >
              {defaultFocusMinutes}m Focus
            </button>
            <button
              onClick={() => { setMinutes(5); setSeconds(0); setMode("break"); setIsActive(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${mode === 'break' && minutes === 5 ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-theme-text-muted hover:text-theme-text-main'}`}
            >
              5m Break
            </button>
            <button
              onClick={() => { setMinutes(15); setSeconds(0); setMode("break"); setIsActive(false); }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${mode === 'break' && minutes === 15 ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' : 'text-theme-text-muted hover:text-theme-text-main'}`}
            >
              15m Long Break
            </button>
          </div>

          <p className="text-[10px] text-theme-text-muted mt-4 leading-normal max-w-xs">
            Each completed focus session is automatically logged to your analytics dashboard.
          </p>

        </div>
      </div>

      {/* Right side: Blocker & Breathing Guide */}
      <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
        
        {/* Diaphragmatic Breathing Helper */}
        <div className="glass-card rounded-xl p-6 relative overflow-hidden flex-1 flex flex-col justify-between min-h-[220px]">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Wind className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-theme-text-main text-sm">Empathetic Breathing Guide</h3>
            </div>
            <p className="text-xs text-theme-text-muted leading-normal">
              Slow down cortical activity, relieve deadline panic, and re-oxygenate your focus.
            </p>
          </div>

          {breathingActive ? (
            <div className="flex flex-col items-center justify-center my-4">
              <motion.div 
                animate={{
                  scale: breathPhase === "In" ? 1.5 : breathPhase === "Hold" ? 1.5 : 1.0,
                }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center relative border shadow-lg ${
                  breathPhase === 'In' ? 'bg-emerald-500/15 border-emerald-400 text-emerald-500 glow-primary' :
                  breathPhase === 'Hold' ? 'bg-amber-500/15 border-amber-400 text-amber-500' :
                  'bg-indigo-500/15 border-indigo-400 text-indigo-500'
                }`}
              >
                <span className="text-[10px] font-black tracking-wider uppercase">{breathPhase}</span>
                <span className="text-[8px] font-mono mt-0.5">{breathCount}s</span>
              </motion.div>
              <span className="text-[11px] text-theme-text-muted font-bold mt-4">
                {breathPhase === 'In' ? 'Inhale through the nose...' :
                 breathPhase === 'Hold' ? 'Sustain oxygen pressure...' :
                 'Slowly release from mouth...'}
              </span>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-theme-text-muted font-medium">Click below to activate a 4-4-4 diaphragmatic pacing loop.</p>
            </div>
          )}

          <button
            onClick={() => { setBreathingActive(!breathingActive); setBreathPhase("In"); setBreathCount(4); }}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              breathingActive 
                ? "bg-theme-input-bg border border-theme-border text-red-500" 
                : "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20"
            }`}
          >
            {breathingActive ? "Deactivate Breathing Helper" : "Activate Diaphragmatic Breath Helper"}
          </button>
        </div>

        {/* Website Distraction blocker */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-theme-border pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-theme-text-main text-sm">Focus Shield (Block List)</h3>
            </div>

            <button
              onClick={() => setShieldActive(!shieldActive)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                shieldActive 
                  ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-500" 
                  : "bg-red-500/10 border border-red-500/30 text-red-500"
              }`}
            >
              {shieldActive ? "SHIELD ACTIVE" : "SHIELD OFFLINE"}
            </button>
          </div>

          <p className="text-xs text-theme-text-muted leading-normal mb-4">
            Your personal distraction blocklist. Use a browser extension or hosts file to enforce blocking outside this app.
          </p>

          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 mb-4">
            {distractions.map((site) => (
              <div 
                key={site} 
                className="flex items-center justify-between p-2 bg-theme-active-nav border border-theme-border rounded-lg text-xs text-theme-text-main"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldAlert className="w-3.5 h-3.5 text-theme-text-muted" />
                  <span className="truncate">{site}</span>
                </div>
                <button
                  onClick={() => handleRemoveSite(site)}
                  className="text-theme-text-muted hover:text-red-500 cursor-pointer p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddSite} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. reddit.com"
              value={newSite}
              onChange={(e) => setNewSite(e.target.value)}
              className="flex-1 bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg px-3 py-1.5 text-xs text-theme-text-main placeholder-theme-text-muted/60"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-xs text-white font-bold rounded-lg cursor-pointer shrink-0"
            >
              Block
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}

