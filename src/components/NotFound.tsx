import React from "react";
import { motion } from "motion/react";
import { Compass, ArrowLeft, RefreshCw, MessageSquare } from "lucide-react";

interface NotFoundProps {
  onReturn: () => void;
  title?: string;
  message?: string;
  code?: string;
}

export default function NotFound({ 
  onReturn, 
  title = "Lost in CollabSpace?", 
  message = "The channel, direct thread, or page you are looking for does not exist, has been deleted, or has drifted out of orbit.",
  code = "404"
}: NotFoundProps) {
  return (
    <div id="not-found-viewport" className="min-h-screen w-screen bg-[#1E1F22] text-[#DBDEE1] relative overflow-hidden flex flex-col justify-between font-sans select-none">
      
      {/* Background patterns and glowing ambient lights */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      <div className="absolute top-[20%] left-[25%] w-[40%] h-[40%] rounded-full bg-[#5865F2]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[25%] w-[40%] h-[40%] rounded-full bg-fuchsia-500/5 blur-[150px] pointer-events-none" />

      {/* Mini top brand bar */}
      <header className="h-16 px-6 lg:px-12 flex items-center gap-3 border-b border-[#2B2D31]/40 bg-[#1E1F22]/70 backdrop-blur-md z-10 flex-shrink-0">
        <img src="/collabspace_logo.png" alt="CollabSpace Logo" className="w-10 h-10 object-contain rounded-xl shadow-md" />
        <span className="font-bold text-lg text-white tracking-tight">
          Collab<span className="text-[#5865F2]">Space</span>
        </span>
      </header>

      {/* Main 404 Hero layout */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center z-10 relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full bg-[#2B2D31]/90 border border-[#1e1f22] p-8 rounded-2xl shadow-2xl relative"
        >
          {/* Decorative neon top bar */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#5865F2] to-fuchsia-500 rounded-t-2xl" />

          {/* Big Glowing Error Code */}
          <div className="relative mb-6 select-none">
            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#5865F2] to-fuchsia-500 tracking-widest leading-none drop-shadow-sm">
              {code}
            </h1>
            <div className="absolute inset-0 text-8xl font-black text-white/5 tracking-widest leading-none blur-sm pointer-events-none">
              {code}
            </div>
          </div>

          {/* Icon */}
          <div className="mx-auto w-12 h-12 rounded-xl bg-[#1E1F22] border border-[#1e1f22]/60 flex items-center justify-center text-[#5865F2] mb-5">
            <Compass className="w-6 h-6 animate-pulse" />
          </div>

          {/* Text labels */}
          <div className="space-y-3 mb-8">
            <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
            <p className="text-[#949BA4] text-xs leading-relaxed font-medium">
              {message}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={onReturn}
              className="w-full py-3 bg-[#5865F2] hover:bg-indigo-600 text-white text-xs uppercase tracking-wider font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Workspace</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-[#1E1F22] hover:bg-[#35373C] border border-[#1e1f22] text-[#DBDEE1] text-xs uppercase tracking-wider font-bold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Connection</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Mini clean footer */}
      <footer className="h-12 border-t border-[#2B2D31]/40 bg-[#1e1f22]/80 backdrop-blur flex items-center justify-center text-[10px] text-[#949BA4] flex-shrink-0">
        <span>© {new Date().getFullYear()} CollabSpace. Secure cloud integration enabled.</span>
      </footer>

    </div>
  );
}
