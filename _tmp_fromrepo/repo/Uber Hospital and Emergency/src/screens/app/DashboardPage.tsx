import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Siren, HandHeart, MapPin, Zap, Activity, Navigation } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';

import { listenHardwareSensor, type HardwareSensorDoc } from '../../data/backendAdmin';

function useSensors(uid: string) {
  const [data, setData] = useState<HardwareSensorDoc | null>(null);

  useEffect(() => {
    return listenHardwareSensor(uid, setData);
  }, [uid]);

  return { 
    speed: data?.speedKmh ?? 0, 
    impact: data?.impactG ?? 0, 
    tilt: data?.tiltRatio ?? 0,
    hasLocation: !!data?.location
  };
}

export const DashboardPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const name = user?.displayName?.split(' ')[0] || 'there';
  const { speed, impact, tilt } = useSensors(user?.uid || 'guest');
  const [sosPulsing, setSosPulsing] = useState(false);

  const handleSos = () => {
    setSosPulsing(true);
    // Vibrate if supported
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    setTimeout(() => nav('/app/sos'), 300);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-full bg-[#0a0b0f] dark:bg-[#0a0b0f] flex flex-col px-4 pt-8 pb-4 max-w-lg mx-auto w-full space-y-4">

      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-white/35 font-medium">{greeting}</p>
          <h1 className="text-2xl font-black text-white mt-0.5">{name} 👋</h1>
        </div>
        {/* Monitoring badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black text-emerald-300 tracking-wide">MONITORING</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-2xl border border-white/[0.06] bg-[#13141a] p-1 gap-1">
        <button
          onClick={() => nav('/app/sos')}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black text-white transition active:scale-95"
          style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}
        >
          <Siren className="h-3.5 w-3.5" /> I Need Help
        </button>
        <button
          onClick={() => nav('/app/help')}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black text-white/50 hover:text-white hover:bg-white/5 transition active:scale-95"
        >
          <HandHeart className="h-3.5 w-3.5" /> I Can Help
        </button>
      </div>

      {/* Live sensor cards */}
      <div className="grid grid-cols-2 gap-2">
        <SensorCard
          icon={<Navigation className="h-4 w-4 text-blue-400" />}
          label="Speed"
          value={`${speed.toFixed(0)}`}
          unit="km/h"
          color="blue"
          barPct={Math.min(100, (speed / 120) * 100)}
        />
        <SensorCard
          icon={<Zap className="h-4 w-4 text-amber-400" />}
          label="Impact"
          value={impact.toFixed(2)}
          unit="G"
          color={impact > 2 ? 'red' : 'amber'}
          barPct={Math.min(100, (impact / 4) * 100)}
        />
        <SensorCard
          icon={<Activity className="h-4 w-4 text-purple-400" />}
          label="Tilt"
          value={`${tilt.toFixed(0)}`}
          unit="°"
          color={tilt > 30 ? 'red' : 'purple'}
          barPct={Math.min(100, (tilt / 45) * 100)}
        />
        <SensorCard
          icon={<MapPin className="h-4 w-4 text-emerald-400" />}
          label="Location"
          value="Active"
          unit="GPS"
          color="emerald"
          barPct={100}
        />
      </div>

      {/* Central SOS Button */}
      <div className="flex flex-col items-center py-4">
        <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest mb-4">Press in emergency</p>
        <AnimatePresence>
          <motion.button
            id="home-sos-button"
            onClick={handleSos}
            animate={sosPulsing ? { scale: [1, 0.95, 1.05, 1] } : { scale: 1 }}
            whileTap={{ scale: 0.93 }}
            transition={{ duration: 0.3 }}
            className="relative h-36 w-36 rounded-full flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              boxShadow: '0 0 0 12px rgba(220,38,38,0.08), 0 0 0 24px rgba(220,38,38,0.04), 0 0 50px rgba(220,38,38,0.5)',
            }}
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full border-2 border-red-500/40 animate-ping" style={{ animationDuration: '2s' }} />
            <Siren className="h-10 w-10 text-white mb-1" strokeWidth={1.5} />
            <span className="text-xs font-black text-white tracking-wider">SOS</span>
          </motion.button>
        </AnimatePresence>
        <p className="text-[10px] text-white/20 mt-4">Hold or tap to trigger emergency</p>
      </div>

      {/* Quick helpline strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { num: '112', label: 'Emergency', color: '#dc2626' },
          { num: '108', label: 'Ambulance', color: '#10b981' },
          { num: '100', label: 'Police', color: '#3b82f6' },
          { num: '1091', label: 'Women', color: '#a855f7' },
        ].map(h => (
          <a key={h.num} href={`tel:${h.num}`}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.05] bg-white/[0.03] py-3 transition active:scale-95">
            <span className="text-sm font-black" style={{ color: h.color }}>{h.num}</span>
            <span className="text-[9px] text-white/30 font-semibold">{h.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
};

const colorMap: Record<string, string> = {
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  emerald: '#10b981',
};

const SensorCard = ({
  icon, label, value, unit, color, barPct,
}: { icon: React.ReactNode; label: string; value: string; unit: string; color: string; barPct: number }) => (
  <div className="rounded-2xl border border-white/[0.05] bg-[#13141a] p-3 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      {icon}
      <span className="text-[9px] font-bold text-white/25 uppercase tracking-wider">{label}</span>
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-black text-white">{value}</span>
      <span className="text-[10px] text-white/30 font-medium">{unit}</span>
    </div>
    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${barPct}%`, background: colorMap[color] ?? '#10b981' }}
      />
    </div>
  </div>
);
