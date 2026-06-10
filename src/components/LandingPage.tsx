import React, { useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { 
  MessageSquare, Zap, Shield, Sparkles, ArrowRight, 
  Activity, Flame
} from "lucide-react";

interface LandingPageProps {
  onLaunch: () => void;
}

export default function LandingPage({ onLaunch }: LandingPageProps) {
  // Force scroll to top on mount
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, []);

  // Mouse tilt animation coordinates for the 3D showcase card
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs to avoid jittery rotation
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), { stiffness: 150, damping: 20 });

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Relative coordinates between -0.5 and 0.5
    const relativeX = (event.clientX - rect.left) / width - 0.5;
    const relativeY = (event.clientY - rect.top) / height - 0.5;

    x.set(relativeX);
    y.set(relativeY);
  }

  function handleMouseLeave() {
    // Reset to center smoothly
    x.set(0);
    y.set(0);
  }

  return (
    <div id="landing-container" className="min-h-screen bg-[#1E1F22] text-[#DBDEE1] relative overflow-x-hidden font-sans select-none scroll-smooth w-full flex flex-col justify-between">
      {/* Background Grid Pattern + Radial Ambient Lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#5865F2]/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/5 blur-[150px] pointer-events-none" />

      {/* Styled Glass Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#1E1F22]/70 backdrop-blur-md border-b border-[#2B2D31]/40 h-16 px-6 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/collabspace_logo.png" alt="CollabSpace Logo" className="w-12 h-12 object-contain rounded-xl shadow-lg shadow-[#5865F2]/25" />
          <span className="font-bold text-lg text-white tracking-tight flex items-center gap-1.5">
            Collab<span className="text-[#5865F2]">Space</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#949BA4] bg-[#2B2D31]/45 px-3 py-1.5 rounded-full border border-[#1e1f22]/20">
            <span className="w-2 h-2 bg-[#23A559] rounded-full animate-pulse" />
            <span className="font-semibold tracking-wide">Chat Service Online</span>
          </div>
          
          <button 
            onClick={onLaunch}
            className="text-xs font-bold text-white bg-[#5865F2] hover:bg-opacity-95 transition-all px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            Launch Client
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Hero Section Container */}
      <main className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 md:pt-20 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center flex-1">
        
        {/* Left Column Text & Action Hub */}
        <div className="lg:col-span-6 space-y-8 flex flex-col justify-center text-left">
          
          {/* Version / Release Tag */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-[#2B2D31]/80 border border-[#1e1f22] rounded-full px-3.5 py-1.5 w-fit"
          >
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#23A559] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#23A559]"></span>
            </span>
            <span className="text-[11px] font-bold text-white tracking-widest uppercase">High Performance Messaging Workspace</span>
          </motion.div>

          {/* Majestic Hero Typography */}
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]"
            >
              Real-time collaboration. <br />
              <span className="text-[#5865F2] relative">
                Zero friction.
                <span className="absolute bottom-1 left-0 w-full h-[6px] bg-[#5865F2]/20 rounded-full" />
              </span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base md:text-lg text-[#949BA4] max-w-xl font-normal leading-relaxed"
            >
              Experience instant communication with your team. Access secure chat channels, private messaging threads, and custom profile tags immediately. Set up an account and start collaborating in real-time.
            </motion.p>
          </div>

          {/* Action CTAs */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap items-center gap-4"
          >
            <button
              onClick={onLaunch}
              className="px-8 py-4 bg-[#5865F2] hover:bg-opacity-95 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-[#5865F2]/25 cursor-pointer flex items-center gap-2 group text-sm md:text-base"
            >
              Launch Chatroom
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
            
            <a
              href="#key-features"
              className="px-6 py-4 bg-[#2B2D31] hover:bg-[#35373C] border border-[#1e1f22] text-white font-semibold rounded-xl transition-all cursor-pointer text-sm md:text-base flex items-center gap-1.5"
            >
              Explore Features
            </a>
          </motion.div>

          {/* High-Contrast Interactive Floating Metadata Tags */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-3 gap-6 pt-6 border-t border-[#2B2D31]/40 max-w-lg"
          >
            <div>
              <p className="text-xl md:text-2xl font-black text-white">100%</p>
              <p className="text-[11px] text-[#949BA4] uppercase font-bold tracking-wider mt-1">Instant Sync</p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-white">&lt; 3ms</p>
              <p className="text-[11px] text-[#949BA4] uppercase font-bold tracking-wider mt-1">Delivery Time</p>
            </div>
            <div>
              <p className="text-xl md:text-2xl font-black text-white">Secure</p>
              <p className="text-[11px] text-[#949BA4] uppercase font-bold tracking-wider mt-1">Cloud Saved</p>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Stunning Interactive 3D Perspective Card Showcase */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-6 flex justify-center items-center h-[460px] md:h-[540px] relative pointer-events-auto"
          style={{ perspective: 1000 }}
        >
          {/* Main 3D Card utilizing mouse tilt states */}
          <motion.div
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }}
            className="w-full max-w-[390px] md:max-w-[420px] bg-[#2B2D31]/95 rounded-2xl border border-[#1e1f22] p-6 shadow-2xl relative cursor-grab active:cursor-grabbing hover:shadow-[#5865F2]/10 transition-shadow duration-300"
          >
            {/* Header Element with deep 3D separation */}
            <div 
              style={{ transform: "translateZ(30px)" }}
              className="flex items-center justify-between pb-4 border-b border-[#1e1f22]/60 mb-5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-full bg-[#F23F43]" />
                <div className="w-3 h-3 rounded-full bg-[#FAA81A]" />
                <div className="w-3 h-3 rounded-full bg-[#23A559]" />
                <span className="text-[11px] tracking-wide font-bold text-[#949BA4] uppercase ml-2 select-none">Holographic #general</span>
              </div>
              <span className="p-1.5 bg-[#1E1F22] rounded-md text-[#5865F2]">
                <Activity className="w-3.5 h-3.5 animate-pulse" />
              </span>
            </div>

            {/* Embedded mockup chats inside the layer */}
            <div className="space-y-4 relative">
              
              {/* Message 1 (Moderate Depth) */}
              <div 
                style={{ transform: "translateZ(45px)" }}
                className="flex items-start gap-3 bg-[#1E1F22]/70 rounded-xl p-3 border border-white/5"
              >
                <div className="w-7 h-7 rounded-full bg-[#23A559] flex items-center justify-center font-black text-[10px] text-white">
                  PE
                </div>
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white">PixelEcho</span>
                    <span className="text-[9px] text-[#949BA4]">Just now</span>
                  </div>
                  <p className="text-[11.5px] text-[#DBDEE1]">Is the local high-performance message cache enabled?</p>
                </div>
              </div>

              {/* Message 2 (Higher Depth) */}
              <div 
                style={{ transform: "translateZ(70px)" }}
                className="flex items-start gap-3 bg-[#5865F2] rounded-xl p-3.5 shadow-lg border border-white/10 relative -left-4 -right-1"
              >
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center font-black text-[10px] text-[#5865F2]">
                  CY
                </div>
                <div className="space-y-1 overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-white">CyberScribe</span>
                    <span className="bg-[#23a559] text-[8px] font-black tracking-wide text-white px-1.5 py-0.5 rounded uppercase">Server</span>
                  </div>
                  <p className="text-[12px] font-medium text-white leading-snug">Yes! Messages deliver instantly to all group members in real-time. Try moving your cursor—this layout preserves full 3D perspective!</p>
                </div>
              </div>

              {/* Message 3 (Extreme Holographic Floating Element) */}
              <div 
                style={{ transform: "translateZ(90px)" }}
                className="bg-[#1E1F22] p-2.5 rounded-lg border border-[#5865F2]/40 shadow-xl max-w-fit absolute top-[70%] right-[5%] flex items-center gap-2.5 text-[11px]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#23A559] animate-ping" />
                <span className="text-white font-bold">12 Users Online Now</span>
                <Sparkles className="w-3.5 h-3.5 text-[#FAA81A]" />
              </div>
            </div>

            {/* Input Mockup Box (Moderate Depth) */}
            <div 
              style={{ transform: "translateZ(50px)" }}
              className="mt-6 bg-[#1E1F22]/70 border border-[#1e1f22] p-2.5 rounded-xl flex items-center justify-between"
            >
              <span className="p-1 bg-[#2B2D31] rounded text-[#949BA4] text-[10px] font-bold">#</span>
              <span className="text-[11px] text-zinc-650 flex-1 ml-2.5">Send interactive response...</span>
              <div className="w-2.5 h-2.5 rounded-full bg-[#5865F2]" />
            </div>
          </motion.div>
        </motion.div>

      </main>

      {/* Feature Grid / Technological Overview */}
      <section id="key-features" className="py-20 bg-[#232428]/40 border-y border-[#2B2D31]/40">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-[#5865F2]">Premium Features</h2>
            <h3 className="text-2xl md:text-3xl font-black text-white leading-tight">Engineered for seamless collaboration</h3>
            <p className="text-sm text-[#949BA4]">Our workspace delivers instant message delivery and real-time state synchronization.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Metric 1 */}
            <div className="bg-[#2B2D31]/60 border border-[#1e1f22]/80 p-6 rounded-xl space-y-4 hover:border-[#5865F2]/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 flex items-center justify-center text-[#5865F2] group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-base">Instant Ingress</h4>
              <p className="text-xs text-[#949BA4] leading-relaxed">
                Experience dynamic message transmissions and updates delivered to all connected workspace colleagues in milliseconds.
              </p>
            </div>

            {/* Metric 2 */}
            <div className="bg-[#2B2D31]/60 border border-[#1e1f22]/80 p-6 rounded-xl space-y-4 hover:border-[#5865F2]/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#23A559] group-hover:scale-110 transition-transform">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-base">Secure Persistence</h4>
              <p className="text-xs text-[#949BA4] leading-relaxed">
                Your workspace profile settings, custom avatars, channels, and conversation histories are securely saved in the cloud.
              </p>
            </div>

            {/* Metric 3 */}
            <div className="bg-[#2B2D31]/60 border border-[#1e1f22]/80 p-6 rounded-xl space-y-4 hover:border-[#5865F2]/40 transition-colors group">
              <div className="w-10 h-10 rounded-lg bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-base">Channels & DMs</h4>
              <p className="text-xs text-[#949BA4] leading-relaxed">
                Seamlessly toggle between public collaboration channels and secure direct messaging with modern live typing indicator displays.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Access Action section */}
      <section className="py-20 text-center space-y-6 max-w-md mx-auto px-6">
        <div className="bg-[#2B2D31] border border-[#1e1f22] p-8 rounded-2xl shadow-xl flex flex-col items-center">
          <Flame className="w-10 h-10 text-[#5865F2] animate-bounce mb-4" />
          <h3 className="text-lg font-black text-white">Join the Messaging Arena</h3>
          <p className="text-xs text-[#949BA4] leading-relaxed mt-2 max-w-xs">
            Generate suggestion names or select your personalized handle to jump straight to the live client terminal.
          </p>
          <button
            onClick={onLaunch}
            className="mt-6 w-full py-3.5 bg-[#5865F2] hover:bg-opacity-95 text-white text-xs tracking-wider uppercase font-extrabold rounded-lg shadow-md cursor-pointer transition-colors"
          >
            Go to Login / Register
          </button>
        </div>
      </section>

      {/* Futuristic Clean Footer */}
      <footer className="border-t border-[#2B2D31]/40 bg-[#1e1f22]/80 backdrop-blur pb-12 pt-8 text-center text-xs text-[#949BA4] w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#23A559] rounded-full animate-pulse" />
            <span>Secure connection to the workspace is active.</span>
          </div>
          <div>
            <span>© {new Date().getFullYear()} CollabSpace. Secure cloud integration enabled.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
