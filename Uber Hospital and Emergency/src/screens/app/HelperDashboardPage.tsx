import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHeart, Trophy, CheckCircle2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenActiveSosRequests, acceptSosRequest, type SosRequestDoc } from '../../data/sos';

type Tab = 'need-help' | 'leaderboard';

const URGENCY_COLORS = {
  critical: { bg: 'bg-red-500/15', border: 'border-red-500/25', text: 'text-red-300', label: 'High' },
  high: { bg: 'bg-amber-500/15', border: 'border-amber-500/25', text: 'text-amber-300', label: 'Medium' },
  low: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/25', text: 'text-emerald-300', label: 'Low' },
};

const LEADERBOARD_DEMO = [
  { rank: 1, name: 'Priya S.', phone: '9876…', helped: 24, points: 4800 },
  { rank: 2, name: 'Arjun M.', phone: '9123…', helped: 19, points: 3800 },
  { rank: 3, name: 'Sneha R.', phone: '9345…', helped: 15, points: 3000 },
  { rank: 4, name: 'Vikram K.', phone: '9567…', helped: 11, points: 2200 },
  { rank: 5, name: 'Meera T.', phone: '9234…', helped: 8, points: 1600 },
];

export const HelperDashboardPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('need-help');
  const [feed, setFeed] = useState<SosRequestDoc[]>([]);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [locationRequested, setLocationRequested] = useState(false);

  // Request location permission when this page loads (not at app start)
  useEffect(() => {
    if (locationRequested) return;
    setLocationRequested(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  }, [locationRequested]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      nav('/login?redirect=/app/helper');
    }
  }, [user, nav]);

  useEffect(() => {
    return listenActiveSosRequests(setFeed);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleHelpNow = async (req: SosRequestDoc) => {
    if (!user) { nav('/login'); return; }
    try {
      await acceptSosRequest({ requestId: req.id, victimId: req.victimId, helperId: user.uid });
      setAcceptedId(req.id);
      showToast('You accepted this request! Head to the location.');
    } catch {
      showToast('Accepted (demo mode).');
      setAcceptedId(req.id);
    }
  };

  const timeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    return min < 1 ? 'just now' : `${min} min ago`;
  };

  const demoFeed: SosRequestDoc[] = feed.length > 0 ? feed : [
    { id: 'd1', victimId: 'usr1', status: 'active', severity: 'critical', location: { lat: 28.614, lon: 77.21 }, radiusKm: 1.5, primaryHelperId: null, createdAt: Date.now() - 60000 * 2 } as any,
    { id: 'd2', victimId: 'usr2', status: 'active', severity: 'high', location: { lat: 28.618, lon: 77.215 }, radiusKm: 1.2, primaryHelperId: null, createdAt: Date.now() - 60000 * 5 } as any,
    { id: 'd3', victimId: 'usr3', status: 'active', severity: 'low', location: { lat: 28.611, lon: 77.204 }, radiusKm: 0.8, primaryHelperId: null, createdAt: Date.now() - 60000 * 12 } as any,
  ];

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-[#0a0b0f] flex flex-col">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full border border-white/10 bg-[#1a1b22] px-5 py-2.5 text-xs font-semibold text-white shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="pt-8 pb-4 px-5">
        <button onClick={() => nav('/')}
          className="mb-4 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition">
          ← Back to Home
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}>
            <HandHeart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">I Can Help</h1>
            <p className="text-xs text-white/35">Respond to nearby emergencies</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
          <button
            id="tab-need-help"
            onClick={() => setTab('need-help')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
              tab === 'need-help'
                ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            🆘 Need Help
          </button>
          <button
            id="tab-leaderboard"
            onClick={() => setTab('leaderboard')}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black transition ${
              tab === 'leaderboard'
                ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" /> Leaderboard
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === 'need-help' && (
            <motion.div key="feed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/25 uppercase tracking-widest">
                  {demoFeed.length} active request{demoFeed.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1.5 text-[10px] text-white/25">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </div>
              </div>

              {demoFeed.map((req) => {
                const urgency = URGENCY_COLORS[req.severity as keyof typeof URGENCY_COLORS] ?? URGENCY_COLORS.low;
                const isAccepted = acceptedId === req.id;
                const distKm = ((Math.random() * 2) + 0.3).toFixed(1);
                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className={`rounded-3xl border ${urgency.border} ${urgency.bg} p-4 space-y-3`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-sm font-black text-white">Emergency nearby</div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-white/40">📍 {distKm} km away</span>
                          <span className="text-white/20">•</span>
                          <span className="flex items-center gap-1 text-[10px] text-white/40">
                            <Clock className="h-3 w-3" />
                            {timeAgo((req as any).createdAt ?? Date.now())}
                          </span>
                        </div>
                      </div>
                      <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${urgency.text} border ${urgency.border}`}>
                        {urgency.label} Urgency
                      </div>
                    </div>

                    {isAccepted ? (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div className="text-xs text-emerald-300 font-semibold">You accepted — head to the location</div>
                      </div>
                    ) : (
                      <button
                        id={`btn-help-now-${req.id}`}
                        onClick={() => handleHelpNow(req)}
                        className="w-full h-11 rounded-2xl text-xs font-black text-white transition active:scale-95"
                        style={{ background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', boxShadow: '0 0 15px rgba(29,78,216,0.3)' }}
                      >
                        🤝 Help Now
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {tab === 'leaderboard' && (
            <motion.div key="leaderboard" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-3">
              <div className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">Community Heroes</div>

              {LEADERBOARD_DEMO.map((entry, i) => (
                <div key={entry.rank}
                  className={`rounded-3xl border p-4 flex items-center gap-4 ${
                    i === 0 ? 'border-amber-500/25 bg-amber-500/8'
                    : i === 1 ? 'border-slate-400/20 bg-slate-400/5'
                    : i === 2 ? 'border-amber-700/20 bg-amber-700/5'
                    : 'border-white/[0.05] bg-white/[0.02]'
                  }`}>
                  {/* Rank */}
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-black ${
                    i === 0 ? 'bg-amber-500 text-white'
                    : i === 1 ? 'bg-slate-400 text-[#0a0b0f]'
                    : i === 2 ? 'bg-amber-700 text-white'
                    : 'bg-white/5 text-white/40'
                  }`}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate">{entry.name}</div>
                    <div className="text-[10px] text-white/35">{entry.helped} people helped</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-blue-300">{entry.points.toLocaleString()}</div>
                    <div className="text-[10px] text-white/30">points</div>
                  </div>
                </div>
              ))}

              <div className="mt-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-4 text-center">
                <div className="text-xs text-white/30">Rewards are shown after you help someone</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
