import React, { useState } from "react";
import { motion } from "motion/react";
import { MessageSquare, Sparkles, Send, UserMinus } from "lucide-react";

interface LoginScreenProps {
  onLogin: (username: string) => void;
  error?: string;
  loading: boolean;
}

const MEMORABLE_NAMES = [
  "NeonPanda", "CosmicEcho", "ZenVibe", "SolarWanderer", "DeepMind",
  "PixelWizard", "AquaNova", "ShadowRider", "CyberScribe", "AstroCoder",
  "SilentStorm", "HyperFocus", "VelvetPulse", "EchoScribe", "CryptoOwl"
];

export default function LoginScreen({ onLogin, error: serverError, loading }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setLocalError("Please enter a username to get started.");
      return;
    }
    if (trimmed.length < 2) {
      setLocalError("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 20) {
      setLocalError("Username must be 20 characters or less.");
      return;
    }
    setLocalError("");
    onLogin(trimmed);
  };

  const handleRandomize = () => {
    const randomName = MEMORABLE_NAMES[Math.floor(Math.random() * MEMORABLE_NAMES.length)];
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const combined = `${randomName}${randomNumber}`;
    setUsername(combined);
    setLocalError("");
  };

  const activeError = localError || serverError;

  return (
    <div id="login-screen-root" className="min-h-screen bg-brand-dark flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      {/* Background ambient decorative blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-blurple/10 blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Modern high-contrast logo mark */}
        <div className="flex flex-col items-center mb-8 text-center animate-fade-in">
          <div className="bg-brand-blurple p-3.5 rounded-[16px] shadow-lg mb-4 cursor-pointer hover:scale-105 transition-transform">
            <MessageSquare className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Real-Time Chat <span className="text-[#5865F2]">Hub</span>
          </h1>
          <p className="text-brand-muted text-sm mt-3 max-w-xs font-normal">
            Instantly connect with online users and rooms without password, account or setup hassle.
          </p>
        </div>

        {/* Central interactive card */}
        <div className="bg-[#2B2D31] border border-[#1e1f22] rounded-xl p-8 shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username-input" className="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2.5">
                Choose Your Display Username
              </label>
              
              <div className="relative">
                <input
                  id="username-input"
                  type="text"
                  placeholder="e.g. CaptainSocks"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (localError) setLocalError("");
                  }}
                  disabled={loading}
                  maxLength={20}
                  className="w-full bg-brand-dark border border-[#1e1f22] rounded-lg px-4 py-3 text-[#DBDEE1] placeholder-zinc-600 focus:outline-none focus:border-brand-blurple focus:ring-1 focus:ring-brand-blurple/50 transition-all font-medium text-sm pr-12"
                />
                
                <button
                  type="button"
                  onClick={handleRandomize}
                  disabled={loading}
                  title="Generate random name suggestion"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-800/40 rounded-lg text-brand-blurple hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {activeError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-3.5 text-xs flex items-start gap-2"
              >
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full mt-1.5 flex-shrink-0" />
                <span>{activeError}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-[#5865F2] hover:bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-md disabled:opacity-50 disabled:pointer-events-none group cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Enter Chatroom</span>
                  <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info metadata */}
        <div className="text-center mt-6">
          <p className="text-xs text-brand-muted flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-brand-online rounded-full animate-pulse" />
            <span>Real-time communication powered by native WebSockets.</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
