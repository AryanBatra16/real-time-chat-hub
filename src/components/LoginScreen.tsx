import React, { useState } from "react";
import { motion } from "motion/react";
import { MessageSquare, Sparkles, Send } from "lucide-react";

interface LoginScreenProps {
  onLogin: (identifier: string, password: string, callback: (err?: string) => void) => void;
  onRegister: (username: string, email: string, password: string, callback: (err?: string) => void) => void;
  loading: boolean;
}

const MEMORABLE_NAMES = [
  "NeonPanda", "CosmicEcho", "ZenVibe", "SolarWanderer", "DeepMind",
  "PixelWizard", "AquaNova", "ShadowRider", "CyberScribe", "AstroCoder",
  "SilentStorm", "HyperFocus", "VelvetPulse", "EchoScribe", "CryptoOwl"
];

export default function LoginScreen({ onLogin, onRegister, loading }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register fields
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const [localError, setLocalError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccessMsg("");

    const identifier = loginIdentifier.trim();
    const password = loginPassword;

    if (!identifier || !password) {
      setLocalError("Please enter both credentials.");
      return;
    }

    onLogin(identifier, password, (err) => {
      if (err) {
        setLocalError(err);
      }
    });
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccessMsg("");

    const username = regUsername.trim();
    const email = regEmail.trim();
    const password = regPassword;

    if (!username || !email || !password) {
      setLocalError("All fields are required.");
      return;
    }

    if (username.length < 2 || username.length > 24 || !/^[a-zA-Z0-9 _]+$/.test(username)) {
      setLocalError("Username must be 2-24 characters (letters, numbers, spaces, underscores).");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setLocalError("Please enter a valid email address.");
      return;
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.");
      return;
    }

    onRegister(username, email, password, (err) => {
      if (err) {
        setLocalError(err);
      } else {
        setSuccessMsg("Account created! Please log in below.");
        setActiveTab('login');
        setLoginIdentifier(username);
        // Reset registration fields
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
      }
    });
  };

  const handleRandomize = () => {
    const randomName = MEMORABLE_NAMES[Math.floor(Math.random() * MEMORABLE_NAMES.length)];
    const randomNumber = Math.floor(100 + Math.random() * 900);
    const combined = `${randomName}${randomNumber}`;
    setRegUsername(combined);
    setLocalError("");
  };

  return (
    <div id="login-screen-root" className="min-h-screen bg-[#1E1F22] flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
      {/* Background ambient decorative blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-[#5865F2]/10 blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Modern high-contrast logo mark */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="bg-[#5865F2] p-3.5 rounded-[16px] shadow-lg mb-4 cursor-pointer hover:scale-105 transition-transform">
            <MessageSquare className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Real-Time Chat <span className="text-[#5865F2]">Hub</span>
          </h1>
          <p className="text-[#949BA4] text-sm mt-3 max-w-xs font-normal">
            Securely connect with online users and rooms using your hub account.
          </p>
        </div>

        {/* Central interactive card */}
        <div className="bg-[#2B2D31] border border-[#1e1f22] rounded-xl p-8 shadow-2xl relative">
          
          {/* Tab Selection */}
          <div className="flex mb-6 border-b border-[#1e1f22]/60">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setLocalError("");
                setSuccessMsg("");
              }}
              className={`flex-1 text-center pb-2.5 border-b-2 font-bold text-sm cursor-pointer transition-colors ${
                activeTab === 'login' ? 'border-[#5865F2] text-white' : 'border-transparent text-[#949BA4] hover:text-[#DBDEE1]'
              }`}
            >
              Log In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setLocalError("");
                setSuccessMsg("");
              }}
              className={`flex-1 text-center pb-2.5 border-b-2 font-bold text-sm cursor-pointer transition-colors ${
                activeTab === 'register' ? 'border-[#5865F2] text-white' : 'border-transparent text-[#949BA4] hover:text-[#DBDEE1]'
              }`}
            >
              Register
            </button>
          </div>

          {successMsg && (
            <div className="bg-[#23A559]/10 border border-[#23A559]/20 text-[#23A559] rounded-lg p-3.5 text-xs mb-4">
              {successMsg}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-identifier" className="block text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                  Username or Email
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  placeholder="Enter username or email"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg px-4 py-2.5 text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]/50 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  placeholder="Enter password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg px-4 py-2.5 text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]/50 transition-all font-medium text-sm"
                />
              </div>

              {localError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-3 text-xs">
                  {localError}
                </div>
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
                    <span>Log In</span>
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-username" className="block text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                  Display Username
                </label>
                <div className="relative">
                  <input
                    id="reg-username"
                    type="text"
                    placeholder="e.g. CaptainSocks"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    disabled={loading}
                    maxLength={24}
                    className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg px-4 py-2.5 text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]/50 transition-all font-medium text-sm pr-12"
                  />
                  <button
                    type="button"
                    onClick={handleRandomize}
                    disabled={loading}
                    title="Generate random name suggestion"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-neutral-800/40 rounded-lg text-[#5865F2] hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                  Email Address
                </label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg px-4 py-2.5 text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]/50 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider text-[#949BA4] mb-2">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#1E1F22] border border-[#1e1f22] rounded-lg px-4 py-2.5 text-[#DBDEE1] placeholder-zinc-650 focus:outline-none focus:border-[#5865F2] focus:ring-1 focus:ring-[#5865F2]/50 transition-all font-medium text-sm"
                />
              </div>

              {localError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg p-3 text-xs">
                  {localError}
                </div>
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
                    <span>Create Account</span>
                    <Send className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer info metadata */}
        <div className="text-center mt-6">
          <p className="text-xs text-[#949BA4] flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-[#23A559] rounded-full animate-pulse" />
            <span>Secure encryption powered by bcrypt and JSON Web Tokens.</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
