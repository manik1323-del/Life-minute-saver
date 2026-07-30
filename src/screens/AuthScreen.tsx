import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { Flame, ShieldAlert, Sparkles, Mail, User as UserIcon, LogIn, KeyRound } from "lucide-react";

export default function AuthScreen() {
  const { login, signup, forgotPassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (activeTab === 'login') {
        if (!email) throw new Error("Please enter your email.");
        if (!password) throw new Error("Please enter your password.");
        await login(email, password);
      } else if (activeTab === 'signup') {
        if (!email || !name) throw new Error("Email and Name are required.");
        if (!password) throw new Error("Please provide a password.");
        if (password.length < 6) throw new Error("Password must be at least 6 characters long.");
        await signup(email, name, password);
      } else {
        if (!email) throw new Error("Please enter your email address.");
        const message = await forgotPassword(email);
        setSuccess(message);
      }
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-bg flex flex-col items-center justify-center p-4 overflow-hidden relative font-sans">
      
      {/* Decorative Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>
 
      {/* Brand Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8 max-w-md"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/10 border border-indigo-500/25 rounded-full text-indigo-500 text-xs font-medium mb-3">
          <Flame className="w-3.5 h-3.5 animate-bounce" />
          <span>HACKATHON GOLD STANDARD</span>
        </div>
        <h1 className="text-4xl font-extrabold text-theme-text-main tracking-tight leading-none mb-2">
          Last-Minute <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500">Life Saver</span>
        </h1>
        <p className="text-sm text-theme-text-muted">
          The AI-powered deadline planner & productivity coach that reorganizes your schedule when everything goes wrong.
        </p>
      </motion.div>
 
      {/* Central Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md glass-card rounded-2xl p-8 shadow-2xl relative glow-primary"
      >
        {/* Toggle Headers */}
        {activeTab !== 'forgot' && (
          <div className="flex border-b border-theme-border mb-6">
            <button
              onClick={() => { setActiveTab('login'); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors duration-200 relative ${
                activeTab === 'login' ? 'text-indigo-500' : 'text-theme-text-muted hover:text-theme-text-main'
              }`}
            >
              Log In
              {activeTab === 'login' && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
            <button
              onClick={() => { setActiveTab('signup'); setError(null); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors duration-200 relative ${
                activeTab === 'signup' ? 'text-indigo-500' : 'text-theme-text-muted hover:text-theme-text-main'
              }`}
            >
              Sign Up
              {activeTab === 'signup' && (
                <motion.div layoutId="auth-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          </div>
        )}
 
        {activeTab === 'forgot' && (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-theme-text-main">Reset Password</h2>
            <button 
              onClick={() => { setActiveTab('login'); setError(null); }}
              className="text-xs text-indigo-500 hover:underline"
            >
              Back to Login
            </button>
          </div>
        )}
 
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {activeTab === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-theme-text-muted">Full Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 pl-10 pr-4 text-sm text-theme-text-main placeholder-theme-text-muted/60 transition-colors"
                />
              </div>
            </div>
          )}
 
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-theme-text-muted">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted" />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 pl-10 pr-4 text-sm text-theme-text-main placeholder-theme-text-muted/60 transition-colors"
              />
            </div>
          </div>

          {activeTab !== 'forgot' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-theme-text-muted">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-theme-input-bg border border-theme-border focus:border-indigo-500 focus:outline-none rounded-lg py-2 pl-10 pr-4 text-sm text-theme-text-main placeholder-theme-text-muted/60 transition-colors"
                />
              </div>
            </div>
          )}
 
          {activeTab === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { setActiveTab('forgot'); setError(null); }}
                className="text-xs text-indigo-500 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}
 
          {/* Feedback Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500"
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-xs text-green-500"
              >
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                <span>{success}</span>
              </motion.div>
            )}
          </AnimatePresence>
 
          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] font-semibold text-white rounded-lg py-2.5 text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>
                  {activeTab === 'login' ? 'Enter Focus Workspace' : 
                   activeTab === 'signup' ? 'Initiate Account' : 'Send Reset Link'}
                </span>
              </>
            )}
          </button>
 
        </form>
 
        {/* Demo info overlay */}
        <div className="mt-6 pt-4 border-t border-theme-border flex flex-col items-center gap-1.5 text-center">
          <div className="flex items-center gap-1.5 text-xs text-theme-text-muted">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span>Sandbox Login Enabled: Any email works!</span>
          </div>
          <p className="text-[10px] text-theme-text-muted/80 leading-normal max-w-xs">
            Demo account will automatically seed real calendar schedules, interactive workloads, and analytics.
          </p>
        </div>
 
      </motion.div>
    </div>
  );
}
