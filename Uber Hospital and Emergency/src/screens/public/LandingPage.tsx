import { useNavigate } from 'react-router-dom';
import { Siren, HandHeart } from 'lucide-react';
import { motion } from 'framer-motion';

export const LandingPage = () => {
  const nav = useNavigate();

  return (
    <div className="min-h-dvh bg-[#0a0b0f] relative flex flex-col items-center justify-center overflow-hidden px-6">
      {/* Radial ambient glow — red for emergency */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.12) 0%, transparent 70%)' }} />

      {/* removed pulse rings per user request */}

      <div className="relative z-10 w-full max-w-xs flex flex-col items-center text-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 180, damping: 20 }}
          className="mb-7"
        >
          <div className="relative h-20 w-20 mx-auto flex items-center justify-center rounded-full"
            style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', boxShadow: '0 0 50px rgba(220,38,38,0.5), 0 0 80px rgba(220,38,38,0.2)' }}>
            <Siren className="h-9 w-9 text-white" strokeWidth={2} />
          </div>
        </motion.div>

        {/* App name */}
        <motion.h1
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="text-4xl font-black text-white tracking-tight"
        >
          Arogya Raksha
        </motion.h1>

        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mt-2 text-sm text-white/40 font-medium"
        >
          Emergency Response, When Every Second Counts
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="mt-12 w-full flex flex-col gap-4"
        >
          {/* I Need Help — critical action */}
          <button
            id="btn-need-help"
            onClick={() => nav('/app/sos')}
            className="relative w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-base font-black text-white overflow-hidden transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 30px rgba(220,38,38,0.4), 0 4px 20px rgba(0,0,0,0.4)' }}
          >
            <span className="text-xl">🚨</span>
            I Need Help
          </button>

          {/* I Can Help */}
          <button
            id="btn-can-help"
            onClick={() => nav('/app/helper')}
            className="relative w-full flex items-center justify-center gap-3 rounded-2xl py-5 text-base font-black text-white overflow-hidden transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', boxShadow: '0 0 30px rgba(29,78,216,0.35), 0 4px 20px rgba(0,0,0,0.4)' }}
          >
            <HandHeart className="h-5 w-5" />
            I Can Help
          </button>
        </motion.div>

        {/* Login / Signup — unobtrusive */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-10 text-xs text-white/25"
        >
          <span>Have an account? </span>
          <button
            id="btn-login"
            onClick={() => nav('/login')}
            className="text-white/50 underline underline-offset-2 hover:text-white/80 transition"
          >
            Login
          </button>
          <span className="mx-2">•</span>
          <button
            id="btn-signup"
            onClick={() => nav('/signup')}
            className="text-white/50 underline underline-offset-2 hover:text-white/80 transition"
          >
            Sign up
          </button>
        </motion.div>
      </div>
    </div>
  );
};
