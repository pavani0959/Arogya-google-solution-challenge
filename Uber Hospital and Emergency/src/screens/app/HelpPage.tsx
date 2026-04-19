import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HandHeart, CheckCircle2, Clock, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../auth/AuthProvider';
import { listenActiveSosRequests, acceptSosRequest, updateAssignment, type SosRequestDoc } from '../../data/sos';
import { rewardHelperPoints } from '../../data/user';
import { LocationSearchModal } from '../../components/LocationSearchModal';
import { useSharedLocation, hasGrantedGPS } from '../../hooks/useSharedLocation';
import { getDistance } from '../../lib/distance';

type Tab = 'need-help' | 'leaderboard';
type Sort = 'nearest' | 'urgent';

const URGENCY: Record<string, { bg: string; border: string; text: string; dot: string; label: string }> = {
  critical: { bg: 'bg-red-500/12', border: 'border-red-500/20', text: 'text-red-300', dot: 'bg-red-500', label: 'High' },
  high:     { bg: 'bg-amber-500/12', border: 'border-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400', label: 'Medium' },
  major:    { bg: 'bg-amber-500/12', border: 'border-amber-500/20', text: 'text-amber-300', dot: 'bg-amber-400', label: 'Medium' },
  low:      { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' },
  minor:    { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' },
};

const DEFAULT_URGENCY = { bg: 'bg-emerald-500/12', border: 'border-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400', label: 'Low' };

const LEADERBOARD = [
  { rank: 1, name: 'Priya S.', helped: 24, points: 4800 },
  { rank: 2, name: 'Arjun M.', helped: 19, points: 3800 },
  { rank: 3, name: 'Sneha R.', helped: 15, points: 3000 },
  { rank: 4, name: 'Vikram K.', helped: 11, points: 2200 },
  { rank: 5, name: 'Meera T.', helped: 8, points: 1600 },
];

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  return m < 1 ? 'just now' : `${m} min ago`;
}

// OSM iframe map — no API key required
const OsmMap = ({ lat, lon }: { lat: number; lon: number }) => {
  const bbox = `${lon - 0.012}%2C${lat - 0.012}%2C${lon + 0.012}%2C${lat + 0.012}`;
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
  return (
    <div className="relative w-full h-full">
      <iframe
        width="100%"
        height="100%"
        className="absolute inset-0 filter invert hue-rotate-180 opacity-70 pointer-events-none"
        src={src}
        style={{ border: 0 }}
        title="Emergency Location"
      />
      {/* Victim marker overlay */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        <div className="relative">
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-60" style={{ animationDuration: '1.5s' }} />
          <div className="h-5 w-5 rounded-full bg-red-500 border-2 border-white shadow-lg" />
        </div>
      </div>
    </div>
  );
};

export const HelpPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('need-help');
  const [sort, setSort] = useState<Sort>('nearest');
  const [feed, setFeed] = useState<SosRequestDoc[]>([]);
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // IMPORTANT: Use a SEPARATE storage key so HelpPage location is fully
  // independent from SosPage. Changes to SOS location won't affect this.
  const { currentLocation, locStatus, saveLocation, requestGPS } = useSharedLocation('arogya_raksha_help_location');
  const [isLocating, setIsLocating] = useState(true);
  const [showManual, setShowManual] = useState(false);

  // ── On mount: silently try GPS. Don’t wipe existing location (persists per session) ──
  useEffect(() => {
    // If GPS was previously granted, this silently refreshes to live location.
    // If permission is 'prompt', it returns null (no popup) and keeps existing location.
    // showAlert:false = if denied, just show UI banner, no intrusive alert popup.
    requestGPS({ silent: false, showAlert: false }).finally(() => setIsLocating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if not logged in; listen to SOS feed
  useEffect(() => {
    if (!user) { nav('/login?redirect=/app/help'); return; }
    return listenActiveSosRequests(setFeed);
  }, [user, nav]);

  // Sync helper location to all active assignments
  useEffect(() => {
    if (!currentLocation || locStatus !== 'ok') return;
    const vals = Object.values(accepted);
    vals.forEach(assignmentId => {
      if (!assignmentId.startsWith('demo-')) {
        updateAssignment(assignmentId, {
          lastLocation: { lat: currentLocation.lat, lon: currentLocation.lon },
        }).catch(() => {});
      }
    });
  }, [currentLocation, locStatus, accepted]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleHelp = async (req: SosRequestDoc) => {
    if (!currentLocation) {
      showToast('Enable or select location to help others');
      setShowManual(true);
      return;
    }
    if (!user) { nav('/login'); return; }
    let assignmentId = `demo-${Date.now()}`;
    try {
      assignmentId = await acceptSosRequest({ requestId: req.id, victimId: req.victimId, helperId: user.uid });
    } catch { /* demo fallback */ }
    setAccepted(s => ({ ...s, [req.id]: assignmentId }));
    showToast('✅ Accepted — head to the location now!');
  };

  // Compute distances and filter to 5km radius
  const items = feed
    .map(req => {
      const loc = req.location ?? { lat: 28.6139, lon: 77.209 };
      const dist = currentLocation
        ? getDistance(currentLocation.lat, currentLocation.lon, loc.lat, loc.lon)
        : NaN;
      return { ...req, dist, loc };
    })
    .filter(req => isNaN(req.dist) || req.dist <= 5.0)
    .sort((a, b) =>
      sort === 'urgent'
        ? (a.severity === 'critical' ? -1 : 1)
        : (isNaN(a.dist) ? 999 : a.dist) - (isNaN(b.dist) ? 999 : b.dist)
    );

  if (!user) return null;

  return (
    <div className="min-h-full bg-[#0a0b0f] flex flex-col max-w-lg mx-auto w-full">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-[#1c1d25] border border-white/10 px-5 py-2.5 text-xs font-semibold text-white shadow-xl whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="px-4 pt-10 pb-3">
        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 20px rgba(29,78,216,0.3)' }}>
            <HandHeart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">I Can Help</h1>
            <p className="text-xs text-white/35">Respond to nearby emergencies</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl border border-white/[0.05] bg-[#13141a] p-1 gap-1">
          {(['need-help', 'leaderboard'] as const).map((id) => (
            <button key={id} id={`tab-${id}`} onClick={() => setTab(id)}
              className={[
                'flex-1 py-2.5 rounded-xl text-xs font-black transition',
                tab === id
                  ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                  : 'text-white/35 hover:text-white/60',
              ].join(' ')}>
              {id === 'need-help' ? '🆘 Need Help' : '🏆 Leaderboard'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        {/* ─── LOCATION BANNER: mirrors SosPage 3-state logic ─── */}
        {(() => {
          const minsAgo = currentLocation
            ? Math.floor((Date.now() - currentLocation.timestamp) / 60000)
            : null;
          const isFresh = minsAgo !== null && minsAgo <= 8;

          // State A: Spinner while initially connecting
          if (!currentLocation && isLocating) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-4 px-5 py-4" style={{ background: '#f5a623' }}>
                  <div className="h-5 w-5 rounded-full border-2 border-[#7c4a00] border-t-transparent animate-spin shrink-0" />
                  <div className="flex-1">
                    <div className="text-sm font-black text-[#3d2200]">📍 Automatically connecting...</div>
                    <div className="text-xs text-[#7c4a00]">Retrieving your live location</div>
                  </div>
                </div>
              </motion.div>
            );
          }

          // State B: Live GPS active → green + Change manually
          if (currentLocation && isFresh && currentLocation.source === 'gps') {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-3 px-5 py-3 border-b border-emerald-500/20" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-emerald-300">📍 Live Location Active</div>
                    <div className="text-[10px] text-emerald-300/60 truncate">{currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}</div>
                  </div>
                  <span className="text-[10px] text-emerald-400/60 shrink-0">GPS ✓</span>
                </div>
                <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                  <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition">
                    <Search className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                  </button>
                </div>
              </motion.div>
            );
          }

          // State C: Stale / manual location → amber + Enable + Change manually
          if (currentLocation) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
                <div className="w-full flex items-center gap-3 px-5 py-3 border-b border-amber-500/20" style={{ background: 'rgba(245,166,35,0.07)' }}>
                  <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-amber-300">
                      {currentLocation.source === 'manual' ? 'Manually selected' : 'Last locked location:'} {minsAgo === 0 ? 'just now' : `${minsAgo} min ago`}
                    </div>
                    <div className="text-[10px] text-amber-300/50 truncate">{currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}</div>
                  </div>
                </div>
                <button onClick={() => void requestGPS()} className="w-full flex items-center gap-4 px-5 py-3 text-left transition active:brightness-90" style={{ background: '#f5a623' }}>
                  <div className="flex-1">
                    <div className="text-sm font-black text-[#3d2200]">📍 Enable live GPS</div>
                    <div className="text-xs text-[#7c4a00]">For better accuracy</div>
                  </div>
                  <span className="font-black text-lg text-[#7c4a00]">›</span>
                </button>
                <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                  <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition">
                    <Search className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                  </button>
                </div>
              </motion.div>
            );
          }

          // State D: No location at all → yellow prompt (first-time) or retry (returning)
          const alreadyGranted = hasGrantedGPS();
          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
              <button onClick={() => void requestGPS()} className="w-full flex items-center gap-4 px-5 py-4 text-left transition active:brightness-90" style={{ background: '#f5a623' }}>
                <MapPin className="h-5 w-5 text-[#7c4a00] shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-black text-[#3d2200]">
                    {alreadyGranted ? '📍 GPS unavailable' : '📍 No location found'}
                  </div>
                  <div className="text-xs text-[#7c4a00]">
                    {alreadyGranted ? 'Tap to retry connecting' : 'Tap to enable live GPS'}
                  </div>
                </div>
                <span className="font-black text-lg text-[#7c4a00]">›</span>
              </button>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button onClick={() => setShowManual(true)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition">
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Enter location manually</span>
                </button>
              </div>
            </motion.div>
          );
        })()}

        {/* Location Search Modal */}
        <AnimatePresence>
          {showManual && (
            <LocationSearchModal
              onClose={() => setShowManual(false)}
              onSelect={(r) => {
                saveLocation({ lat: r.lat, lon: r.lon, displayName: r.displayName, source: 'manual' });
                setShowManual(false);
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ── NEED HELP TAB ── */}
          {tab === 'need-help' && (
            <motion.div key="feed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="flex flex-col">
              {currentLocation ? (
                <div className="px-4 pt-3 pb-4 space-y-3">
                  {/* Sort bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/25 font-bold uppercase tracking-widest">
                      {items.length} active • <span className="text-emerald-400 animate-pulse">●</span> Live
                    </span>
                    <button onClick={() => setSort(s => s === 'nearest' ? 'urgent' : 'nearest')}
                      className="text-[10px] font-bold text-white/40 hover:text-white/70 transition">
                      Sort: {sort === 'nearest' ? 'Nearest' : 'Most Urgent'} ↕
                    </button>
                  </div>

                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="h-14 w-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
                        <HandHeart className="h-6 w-6 text-white/20" />
                      </div>
                      <p className="text-sm font-bold text-white/40">No active emergencies nearby</p>
                      <p className="text-xs text-white/25 mt-1">You'll be notified when someone needs help within 5km</p>
                    </div>
                  )}

                  {items.map((req, i) => {
                    const u = URGENCY[req.severity] ?? DEFAULT_URGENCY;
                    const distKm = isNaN(req.dist) ? null : req.dist;
                    const distLabel = distKm === null ? '—' : distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
                    const isAccepted = req.id in accepted;
                    const isComplete = completed.has(req.id);
                    const rloc = req.location ?? { lat: 28.6139, lon: 77.209 };
                    const createdMs = (req as unknown as { createdAt?: { seconds?: number } }).createdAt?.seconds
                      ? (req as unknown as { createdAt: { seconds: number } }).createdAt.seconds * 1000
                      : Date.now();

                    return (
                      <motion.div key={req.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`mb-3 rounded-3xl border p-4 space-y-3 ${u.bg} ${u.border}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${u.dot}`} />
                              <span className="text-sm font-black text-white">Emergency nearby</span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-white/40 flex-wrap">
                              <span>📍 {distLabel}</span>
                              <span className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> {timeAgo(createdMs)}
                              </span>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black border ${u.text} ${u.border}`}>
                            {u.label}
                          </span>
                        </div>

                        {isComplete ? (
                          <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span className="text-xs text-emerald-300 font-bold">Task Completed</span>
                            </div>
                            <span className="text-xs font-black text-emerald-400 animate-pulse">+200 pts</span>
                          </div>
                        ) : isAccepted ? (
                          <div className="space-y-3 pt-2">
                            {/* OSM Map — no API key needed */}
                            <div className="relative h-40 rounded-2xl bg-[#0c1420] overflow-hidden border border-white/5">
                              <OsmMap lat={rloc.lat} lon={rloc.lon} />
                              <div className="absolute bottom-2 inset-x-2 flex gap-2">
                                <a href={`https://maps.google.com/?q=${rloc.lat},${rloc.lon}`}
                                  target="_blank" rel="noreferrer"
                                  className="flex-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-[10px] font-bold text-white flex items-center justify-center py-2 h-9 hover:bg-white/20 transition">
                                  Open in Google Maps
                                </a>
                              </div>
                            </div>
                            <button onClick={async () => {
                              if (user) {
                                try { await rewardHelperPoints(user.uid, 200); } catch { /* demo */ }
                              }
                              setCompleted(s => new Set(s).add(req.id));
                              showToast('🏆 Points awarded! Thank you for helping.');
                            }}
                              className="w-full h-11 flex items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-xs font-black text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Done
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => void handleHelp(req)}
                            className="w-full h-11 rounded-2xl text-xs font-black text-white transition active:scale-95"
                            style={{ background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', boxShadow: '0 0 15px rgba(29,78,216,0.3)' }}>
                            🤝 Help Now
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 mt-10">
                  <div className="text-center space-y-4">
                    <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                      <MapPin className="h-6 w-6 text-white/20" />
                    </div>
                    <p className="text-sm font-bold text-white/50">Enable or select location to help others</p>
                    <p className="text-xs text-white/30">We need your location to show relevant emergency requests near you.</p>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── LEADERBOARD TAB ── */}
          {tab === 'leaderboard' && (
            <motion.div key="lb" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="px-4 pt-3 pb-4 space-y-2.5">
              <p className="text-[10px] text-white/25 font-bold uppercase tracking-widest mb-1">Community Heroes</p>
              {LEADERBOARD.map((e, i) => (
                <div key={e.rank}
                  className={`rounded-3xl border flex items-center gap-4 p-4 ${
                    i === 0 ? 'border-amber-500/20 bg-amber-500/8'
                    : i === 1 ? 'border-slate-400/15 bg-slate-400/5'
                    : i === 2 ? 'border-orange-700/15 bg-orange-700/5'
                    : 'border-white/[0.04] bg-white/[0.02]'
                  }`}>
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-sm font-black ${
                    i === 0 ? 'bg-amber-500 text-white'
                    : i === 1 ? 'bg-slate-400 text-slate-900'
                    : i === 2 ? 'bg-orange-700 text-white'
                    : 'bg-white/5 text-white/30'
                  }`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : e.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate">{e.name}</div>
                    <div className="text-[10px] text-white/35">{e.helped} people helped</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-black text-blue-300">{e.points.toLocaleString()}</div>
                    <div className="text-[10px] text-white/30">pts</div>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 text-center text-xs text-white/25">
                Rewards are shown after completing a help request
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
