import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, X, CheckCircle2, ChevronDown, ChevronUp, MapPin, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LocationSearchModal } from '../../components/LocationSearchModal';
import { LiveTrackingMap } from '../../components/LiveTrackingMap';
import { useSharedLocation, hasGrantedGPS } from '../../hooks/useSharedLocation';
import { useAuth } from '../../auth/AuthProvider';
import {
  createSosRequest,
  listenAssignmentsForRequest,
  updateSosRequest,
  listenCurrentSosRequest,
  type SosAssignmentDoc,
} from '../../data/sos';
import { formatEta, formatDistance } from '../../data/routing';

const COUNTDOWN_SECONDS = 8;

const HELPLINES = [
  { label: 'Ambulance', number: '108', color: '#10b981' },
  { label: 'Police', number: '100', color: '#3b82f6' },
  { label: 'Women Helpline', number: '1091', color: '#a855f7' },
  { label: 'Fire', number: '101', color: '#f97316' },
];

export const SosPage = () => {
  const nav = useNavigate();
  const { user } = useAuth();

  // ── Stable guest UID stored in localStorage (survives refreshes + tabs) ───
  const [guestId] = useState(() => {
    let gid = localStorage.getItem('arogya_guest_uid');
    if (!gid) {
      gid = 'guest-' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('arogya_guest_uid', gid);
    }
    return gid;
  });
  const uid = user?.uid ?? guestId;

  // ── Core SOS state ────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'countdown' | 'active' | 'safe'>('countdown');
  const [cdown, setCdown] = useState(COUNTDOWN_SECONDS);
  const [sosId, setSosId] = useState<string | null>(null);
  const [sosLocation, setSosLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [noLocationMode, setNoLocationMode] = useState(false);
  const [assignments, setAssignments] = useState<SosAssignmentDoc[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [showHelplines, setShowHelplines] = useState(false);
  const [callPopup, setCallPopup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);

  const isDoneRef = useRef(false);    // blocks all state updates after cancel/resolve
  const createdRef = useRef(false);   // prevents duplicate Firestore writes
  // ── Part 2: throttle location-sync writes to max 1 per 5 seconds ─────────
  const lastLocUpdateRef = useRef(0);

  const { currentLocation, saveLocation, requestGPS, clearLocation } = useSharedLocation();

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Mount: clear stale location, auto-connect GPS ─────────────────────────
  useEffect(() => {
    clearLocation();
    requestGPS({ silent: false, showAlert: false }).finally(() => setIsLocating(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resume check: if user already has an active SOS, skip countdown ───────
  useEffect(() => {
    const unsub = listenCurrentSosRequest(uid, (existing) => {
      unsub(); // one-time check only
      if (!existing || isDoneRef.current || createdRef.current) return;
      if (existing.status !== 'active') return;
      console.log('[SOS] Resuming existing active SOS:', existing.id);
      createdRef.current = true;
      setSosId(existing.id);
      setSosLocation(existing.location ?? null);
      setNoLocationMode(!existing.hasValidLocation);
      setPhase('active');
      setCdown(0);
    });
    return unsub;
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── LOCAL COUNTDOWN — zero Firestore writes during this phase ────────────
  useEffect(() => {
    if (phase !== 'countdown') return;
    const timer = setInterval(() => {
      if (isDoneRef.current) { clearInterval(timer); return; }
      setCdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── SOS creation — evaluates finalLocation at countdown=0 ─────────────────
  // Keep a ref so the effect below always calls the LATEST version
  // (capturing the latest currentLocation value at fire time).
  const createSosRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const createSos = useCallback(async () => {
    // ── FINAL LOCATION PRIORITY CHAIN ────────────────────────────────────────
    const params = new URLSearchParams(window.location.search);
    const hwLat = params.get('lat');
    const hwLon = params.get('lon');
    const now = Date.now();

    let finalLocation: { lat: number; lon: number; isApproximate?: boolean } | null = null;

    if (hwLat && hwLon) {
      // 1. Hardware sensor coordinates (crash detection) — highest priority
      finalLocation = { lat: Number(hwLat), lon: Number(hwLon) };
    } else if (currentLocation?.source === 'gps' && now - currentLocation.timestamp < 2 * 60 * 1000) {
      // 2. Live GPS — fresh within 2 minutes
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon };
    } else if (currentLocation?.source === 'manual') {
      // 3. Manually selected location
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon };
    } else if (currentLocation && now - currentLocation.timestamp < 8 * 60 * 1000) {
      // 4. Last known location — within 8 minutes (marked as approximate)
      finalLocation = { lat: currentLocation.lat, lon: currentLocation.lon, isApproximate: true };
    }
    // else → no location at all (null)

    console.log('SOS location used:', finalLocation);

    const hasValidLoc = finalLocation !== null;
    setNoLocationMode(!hasValidLoc);
    setSosLocation(finalLocation ? { lat: finalLocation.lat, lon: finalLocation.lon } : null);

    try {
      const saved = await createSosRequest({
        victimId: uid,
        status: 'active',         // written directly as 'active' — no countdown in Firestore
        severity: hwLat ? 'critical' : 'major',
        source: hwLat ? 'hardware' : 'mobile',
        countdown: 0,
        location: finalLocation ? { lat: finalLocation.lat, lon: finalLocation.lon } : null,
        hasValidLocation: hasValidLoc,
        isApproximate: finalLocation?.isApproximate ?? false,
        radiusKm: 5,
      });
      console.log('[SOS] ✅ Saved to Firestore as active:', saved.id, '| location:', finalLocation);
      setSosId(saved.id);
    } catch (err) {
      console.error('[SOS] ❌ Firestore write FAILED:', err);
      showToast('SOS sent (offline mode — check console for error)');
    }

    setPhase('active');
  }, [uid, currentLocation, showToast]);

  // Keep ref in sync so effect below always calls the latest createSos
  useEffect(() => { createSosRef.current = createSos; }, [createSos]);

  // ── Fire createSos exactly once when countdown hits zero ──────────────────
  useEffect(() => {
    if (cdown !== 0 || phase !== 'countdown' || createdRef.current || isDoneRef.current) return;
    createdRef.current = true;
    void createSosRef.current?.();
  }, [cdown, phase]);

  // ── LOCATION SYNC: patch Firestore when location changes while SOS is active
  // Throttled: max 1 write per 5 seconds. Deduped: skips if coords unchanged.
  useEffect(() => {
    if (phase !== 'active' || !sosId || isDoneRef.current || !currentLocation) return;

    // ── Part 2: throttle ─────────────────────────────────────────────────────
    const now = Date.now();
    if (now - lastLocUpdateRef.current < 5000) return;

    const newLoc = { lat: currentLocation.lat, lon: currentLocation.lon };
    const isSame =
      sosLocation &&
      Math.abs(sosLocation.lat - newLoc.lat) < 0.0001 &&
      Math.abs(sosLocation.lon - newLoc.lon) < 0.0001;

    if (isSame) return;

    lastLocUpdateRef.current = now;
    console.log('[SOS] 📍 Location updated (throttled) — patching Firestore:', newLoc);
    setSosLocation(newLoc);
    setNoLocationMode(false);
    updateSosRequest(sosId, { location: newLoc, hasValidLocation: true, isApproximate: false, lastUpdated: now })
      .then(() => console.log('[SOS] ✅ Firestore location patched to:', newLoc))
      .catch((e) => console.error('[SOS] ❌ Patch failed:', e));
  }, [currentLocation, phase, sosId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen to helper assignments for this SOS ─────────────────────────────
  useEffect(() => {
    if (!sosId) return;
    return listenAssignmentsForRequest(sosId, setAssignments, uid);
  }, [sosId, uid]);

  // ── NAVIGATION HELPERS ────────────────────────────────────────────────────
  const goHome = useCallback(() => {
    nav(user ? '/app' : '/', { replace: true });
  }, [nav, user]);

  const cancelAlert = useCallback(() => {
    isDoneRef.current = true;
    showToast('Alert cancelled.');
    if (sosId) {
      sessionStorage.setItem(`ignore_sos_${sosId}`, 'true');
      updateSosRequest(sosId, { status: 'cancelled' }).catch(console.warn);
    }
    goHome();
  }, [sosId, showToast, goHome]);

  const stopAlert = useCallback(() => {
    isDoneRef.current = true;
    if (sosId) {
      sessionStorage.setItem(`ignore_sos_${sosId}`, 'true');
      updateSosRequest(sosId, { status: 'cancelled' }).catch(console.warn);
    }
    goHome();
  }, [sosId, goHome]);

  const markSafe = useCallback(() => {
    isDoneRef.current = true;
    showToast('You are safe! Notifying helpers…');
    if (sosId) {
      sessionStorage.setItem(`ignore_sos_${sosId}`, 'true');
      updateSosRequest(sosId, { status: 'resolved' }).catch(console.warn);
    }
    setPhase('safe');
    setTimeout(goHome, 1800);
  }, [sosId, showToast, goHome]);

  const simulateVoiceFallback = () => {
    const speech = new SpeechSynthesisUtterance(
      'Emergency detected. Possible accident. Location has been shared. Please respond immediately.'
    );
    window.speechSynthesis.speak(speech);
    showToast('🎙️ Voice fallback audio playing');
  };

  const pct = ((COUNTDOWN_SECONDS - cdown) / COUNTDOWN_SECONDS) * 100;
  const circumference = 2 * Math.PI * 54;
  // Display priority: confirmed SOS location → live GPS → null
  const displayCoords = sosLocation ?? (currentLocation ? { lat: currentLocation.lat, lon: currentLocation.lon } : null);

  return (
    <div className="min-h-dvh bg-[#0a0b0f] flex flex-col overflow-hidden">
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

      {/* ── LOCATION BANNER: 3 states ─────────────────────────────────────── */}
      {(() => {
        const minsAgo = currentLocation
          ? Math.floor((Date.now() - currentLocation.timestamp) / 60000)
          : null;
        const isFresh = minsAgo !== null && minsAgo <= 8;

        // State 1: No location at all → yellow warning banner
        if (!currentLocation) {
          if (isLocating) {
            return (
              <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full shrink-0">
                <div className="w-full flex items-center gap-4 px-5 py-4 text-left" style={{ background: '#f5a623' }}>
                  <div className="h-5 w-5 rounded-full border-2 border-[#7c4a00] border-t-transparent animate-spin shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-[#3d2200]">📍 Automatically connecting...</div>
                    <div className="text-xs text-[#7c4a00]">Retrieving highly accurate GPS coordinates</div>
                  </div>
                </div>
              </motion.div>
            );
          }

          const alreadyGranted = hasGrantedGPS();

          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="z-10 w-full shrink-0">
              <button
                onClick={() => void requestGPS()}
                className="w-full flex items-center gap-4 px-5 py-4 text-left transition active:brightness-90"
                style={{ background: '#f5a623' }}
              >
                <MapPin className="h-5 w-5 shrink-0 text-[#7c4a00]" />
                <div className="flex-1">
                  <div className="text-sm font-black text-[#3d2200]">
                    {alreadyGranted ? '📍 GPS unavailable' : '📍 No location found'}
                  </div>
                  <div className="text-xs text-[#7c4a00]">
                    {alreadyGranted ? 'Tap to retry connecting' : 'Tap to enable live GPS for better accuracy'}
                  </div>
                </div>
                <span className="font-black text-lg text-[#7c4a00]">›</span>
              </button>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-white/5 transition"
                >
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Or enter location manually</span>
                </button>
              </div>
            </motion.div>
          );
        }

        // State 2: Fresh live GPS → green banner
        if (isFresh && currentLocation.source === 'gps') {
          return (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="w-full shrink-0">
              <div
                className="w-full flex items-center gap-3 px-5 py-3 border-b border-emerald-500/20"
                style={{ background: 'rgba(16,185,129,0.06)' }}
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-emerald-300">📍 Live Location Active</div>
                  <div className="text-[10px] text-emerald-300/60 truncate">
                    {currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}
                  </div>
                </div>
                <span className="text-[10px] text-emerald-400/60 shrink-0">GPS ✓</span>
              </div>
              <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
                <button
                  onClick={() => setShowManual(true)}
                  className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition"
                >
                  <Search className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-white/50">Change location manually</span>
                </button>
              </div>
            </motion.div>
          );
        }

        // State 3: Stale or manual location
        return (
          <motion.div
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="w-full shrink-0"
          >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-amber-500/20"
              style={{ background: 'rgba(245,166,35,0.07)' }}
            >
              <MapPin className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-amber-300">
                  {currentLocation.source === 'manual' ? 'Manually selected' : 'Last locked location:'} {minsAgo === 0 ? 'just now' : `${minsAgo} min ago`}
                </div>
                <div className="text-[10px] text-amber-300/50 truncate">
                  {currentLocation.displayName ?? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lon.toFixed(5)}`}
                </div>
              </div>
            </div>

            <button
              onClick={() => void requestGPS()}
              className="w-full flex items-center gap-4 px-5 py-3 text-left transition active:brightness-90"
              style={{ background: '#f5a623' }}
            >
              <div className="flex-1">
                <div className="text-sm font-black text-[#3d2200]">📍 Enable live GPS</div>
                <div className="text-xs text-[#7c4a00]">For better accuracy</div>
              </div>
              <span className="font-black text-lg text-[#7c4a00]">›</span>
            </button>
            <div className="w-full bg-[#13141a] border-b border-white/[0.06]">
              <button
                onClick={() => setShowManual(true)}
                className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-white/5 transition"
              >
                <Search className="h-4 w-4 text-blue-400 shrink-0" />
                <span className="flex-1 text-sm font-bold text-white/50">Or change location manually</span>
              </button>
            </div>
          </motion.div>
        );
      })()}

      {/* Location search modal */}
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
        {/* ── COUNTDOWN PHASE ── */}
        {phase === 'countdown' && (
          <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-y-auto">
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.18) 0%, transparent 65%)' }} />

            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4 text-center">
              <motion.div
                animate={{ scale: [1, 1.04, 1] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                className="text-5xl mb-4"
              >
                🚨
              </motion.div>

              <h1 className="text-3xl font-black text-white tracking-tight">SOS ACTIVATED</h1>
              <p className="mt-2 text-sm text-white/50">Sending alerts in {cdown} seconds…</p>

              {/* Circular timer */}
              <div className="relative mt-8 h-32 w-32">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" fill="none">
                  <circle cx="60" cy="60" r="54" stroke="rgba(220,38,38,0.15)" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="54"
                    stroke="rgba(220,38,38,0.9)"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference - (circumference * pct) / 100}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-4xl font-black text-white">{cdown}</span>
                </div>
              </div>

              {/* Status checklist */}
              <div className="mt-8 w-full max-w-xs space-y-2">
                {[
                  { done: currentLocation !== null, label: 'Detecting location' },
                  { done: cdown < 6, label: 'Preparing alert data' },
                  { done: cdown < 3, label: 'Finding nearby helpers' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 transition-all ${item.done ? 'bg-emerald-500' : 'bg-white/10'}`}>
                      {item.done && <CheckCircle2 className="h-3 w-3 text-white" />}
                      {!item.done && <div className="h-2 w-2 rounded-full bg-white/40 animate-pulse" />}
                    </div>
                    <span className={item.done ? 'text-emerald-300' : 'text-white/40'}>{item.label}</span>
                  </div>
                ))}
              </div>

              {/* Guest prompt */}
              {!user && (
                <div className="mt-4 w-full max-w-xs rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] text-white/40 leading-relaxed">
                    📋 <span className="text-white/60 font-semibold">No emergency contacts?</span><br />
                    Add one quickly (optional)
                  </div>
                  <Link to="/signup"
                    className="shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black text-white/70 hover:bg-white/[0.1] transition">
                    Sign up
                  </Link>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-5 w-full max-w-xs flex flex-col gap-3">
                <button
                  id="btn-stop-alert"
                  onClick={stopAlert}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-white/70 hover:bg-white/10 transition active:scale-95"
                >
                  ✕ Stop Alert
                </button>
                <button
                  id="btn-emergency-call-countdown"
                  onClick={() => setCallPopup(true)}
                  className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 py-4 text-sm font-black text-red-300 hover:bg-red-500/20 transition active:scale-95 flex items-center justify-center gap-2"
                >
                  <Phone className="h-4 w-4" /> Emergency Call
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ACTIVE PHASE ── */}
        {phase === 'active' && (
          <motion.div key="active" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-y-auto">
            <div className="px-5 pt-8 pb-4 text-center"
              style={{ background: 'linear-gradient(to bottom, rgba(220,38,38,0.12), transparent)' }}>
              <motion.div className="text-3xl mb-2" animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                🚨
              </motion.div>
              <h1 className="text-2xl font-black text-white">HELP IS ON THE WAY</h1>
              <p className="mt-1 text-sm text-white/45">Stay calm. Help is being arranged.</p>
            </div>

            <div className="px-5 pb-6 space-y-4 flex-1">
              {/* No-location warning banner — shown when SOS created without GPS or manual location */}
              {noLocationMode && (
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/[0.08] p-4">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-black text-amber-300">⚠ Location not found</div>
                      <div className="text-[10px] text-amber-300/60 mt-1 leading-relaxed">
                        Notifying ambulance only. Enable GPS or select location manually to alert nearby helpers.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 space-y-3">
                <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Status</div>
                {[
                  'Ambulance notified',
                  'Emergency contacts alerted',
                  noLocationMode ? '🔒 Nearby helpers — location required' : 'Nearby helpers notified',
                ].map((label, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className={`h-5 w-5 shrink-0 ${i === 2 && noLocationMode ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <span className={`text-sm font-semibold ${i === 2 && noLocationMode ? 'text-amber-300/70' : 'text-white/80'}`}>{label}</span>
                  </div>
                ))}

                {/* Live map */}
                {displayCoords && (() => {
                  // Prefer the assignment whose helper is actively streaming their location.
                  const liveAssignment =
                    assignments.find((a) => a.helperLocation && a.status !== 'cancelled') ??
                    null;

                  if (liveAssignment && liveAssignment.helperLocation) {
                    return (
                      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
                        <div className="flex items-center justify-between px-4 pt-3 pb-2">
                          <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                            Live Tracking
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Helper en route
                          </div>
                        </div>
                        <div className="px-3 pb-3">
                          <LiveTrackingMap
                            viewerRole="victim"
                            victim={{ lat: displayCoords.lat, lon: displayCoords.lon }}
                            helper={{
                              lat: liveAssignment.helperLocation.lat,
                              lon: liveAssignment.helperLocation.lon,
                            }}
                            routeEncoded={liveAssignment.routeEncoded}
                            etaSeconds={liveAssignment.etaSeconds}
                            distanceMeters={liveAssignment.distanceMeters}
                            helperName={liveAssignment.helperName || 'Helper'}
                            height={260}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Fallback: no helper streaming yet → keep OSM preview
                  return (
                    <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden">
                      <div className="px-4 pt-3 pb-1 text-[10px] font-bold text-white/30 uppercase tracking-widest">Live Map</div>
                      <div className="relative h-44"
                        style={{ background: '#0c1420' }}>
                        <iframe
                          width="100%"
                          height="100%"
                          className="absolute inset-0 z-0 opacity-70 filter invert hue-rotate-180"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${displayCoords.lon - 0.01}%2C${displayCoords.lat - 0.01}%2C${displayCoords.lon + 0.01}%2C${displayCoords.lat + 0.01}&layer=mapnik&marker=${displayCoords.lat}%2C${displayCoords.lon}`}
                          style={{ border: 0 }}
                          title="Live Location Map"
                        />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                          <div className="relative">
                            <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-60" style={{ animationDuration: '1.5s' }} />
                            <div className="h-5 w-5 rounded-full bg-red-500 border-2 border-[#13141a] shadow-lg flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex bg-[#13141a] border-t border-white/[0.05]">
                        <div className="px-4 py-3 flex-1">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
                            <MapPin className="h-3.5 w-3.5 text-red-400" />
                            {displayCoords.lat.toFixed(5)}, {displayCoords.lon.toFixed(5)}
                          </div>
                        </div>
                        <a href={`https://maps.google.com/?q=${displayCoords.lat},${displayCoords.lon}`}
                          target="_blank" rel="noreferrer"
                          className="flex shrink-0 items-center justify-center px-4 border-l border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] transition text-[10px] font-bold text-white/60">
                          Open in<br />Google Maps
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Helpers */}
              {assignments.length > 0 && (
                <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-4 space-y-2.5">
                  <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    Active Helpers ({assignments.length})
                  </div>
                  {assignments.map((a) => {
                    const reached = a.status === 'reached' || !!a.arrivedAt;
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-2.5 ${
                          reached
                            ? 'border-emerald-500/25 bg-emerald-500/10'
                            : 'border-blue-500/15 bg-blue-500/5'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${reached ? 'text-emerald-200' : 'text-blue-200'}`}>
                            {a.helperName || `Helper ${a.helperId.slice(0, 6)}`}
                          </div>
                          <div className="text-[10px] text-white/40 mt-0.5">
                            {reached
                              ? '🎉 Arrived at your location'
                              : a.etaSeconds
                                ? `ETA ${formatEta(a.etaSeconds)} • ${formatDistance(a.distanceMeters)}`
                                : a.distanceMeters
                                  ? `${formatDistance(a.distanceMeters)} away`
                                  : 'Connecting…'}
                          </div>
                        </div>
                        {!reached && a.etaSeconds ? (
                          <div className="ml-3 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-[10px] font-black text-blue-200 shrink-0">
                            {formatEta(a.etaSeconds)}
                          </div>
                        ) : reached ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 ml-3" />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bottom action bar */}
            <div className="sticky bottom-0 px-5 py-4 space-y-2 border-t border-white/[0.05]"
              style={{ background: 'linear-gradient(to top, #0a0b0f 60%, transparent)' }}>

              <button
                onClick={simulateVoiceFallback}
                className="w-full h-10 rounded-2xl border border-white/5 bg-white/[0.03] text-[10px] font-bold text-white/40 hover:bg-white/[0.06] transition flex items-center justify-center mb-1">
                Simulate Voice Fallback (Demo Only)
              </button>

              <a id="btn-call-112" href="tel:112"
                className="relative flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black text-white active:scale-95 transition overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.35)' }}>
                <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ animationDuration: '1s' }} />
                <Phone className="h-4 w-4 relative z-10" />
                <span className="relative z-10">📞 Call Emergency (112)</span>
              </a>

              <button id="btn-helplines-toggle"
                onClick={() => setShowHelplines(!showHelplines)}
                className="w-full flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/50 hover:bg-white/[0.07] transition">
                <span>Other helplines</span>
                {showHelplines ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <AnimatePresence>
                {showHelplines && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 pb-1">
                      {HELPLINES.map((h) => (
                        <a key={h.number} href={`tel:${h.number}`}
                          className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.03] py-3 text-xs font-bold text-white/70 hover:bg-white/[0.06] transition active:scale-95 gap-1">
                          <span style={{ color: h.color }}>{h.label}</span>
                          <span className="text-white/40">{h.number}</span>
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Cancel + I Am Safe */}
              <div className="flex gap-2">
                <button id="btn-cancel-alert" onClick={cancelAlert}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-xs font-bold text-white/50 hover:bg-white/10 transition active:scale-95">
                  <X className="h-3.5 w-3.5" /> Cancel Alert
                </button>
                <button id="btn-i-am-safe" onClick={markSafe}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 py-3.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/20 transition active:scale-95">
                  <CheckCircle2 className="h-3.5 w-3.5" /> I Am Safe
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SAFE PHASE ── */}
        {phase === 'safe' && (
          <motion.div key="safe" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-400 mb-4" />
            <h1 className="text-3xl font-black text-white">You are Safe</h1>
            <p className="mt-2 text-sm text-white/45">Notifying all helpers and contacts…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emergency Call Popup */}
      <AnimatePresence>
        {callPopup && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs rounded-3xl border border-white/[0.08] bg-[#13141a] p-6 text-center shadow-2xl">
              <div className="text-3xl mb-3">📞</div>
              <h2 className="text-lg font-black text-white">Call Emergency Services?</h2>
              <p className="mt-1 text-xs text-white/40">This will dial 112. The SOS alert will continue in the background.</p>
              <div className="mt-5 flex gap-2">
                <button onClick={() => setCallPopup(false)}
                  className="flex-1 h-11 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white/60 hover:bg-white/10 transition">
                  Cancel
                </button>
                <a href="tel:112" onClick={() => setCallPopup(false)}
                  className="flex-1 h-11 rounded-2xl flex items-center justify-center text-xs font-black text-white transition active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
                  Call Now
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
