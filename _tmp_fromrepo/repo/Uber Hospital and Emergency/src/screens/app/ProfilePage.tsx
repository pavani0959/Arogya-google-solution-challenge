import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { logout } from '../../auth/authActions';
import { useTheme } from '../../app/ThemeContext';
import { detectCrash, type SensorSample } from '../../features/sos/crashDetection';
import {
  User, Phone, Droplets, Plus, Trash2, ShieldCheck,
  Activity, ShieldAlert, MapPin, Bell, Moon, Sun, LogOut, ChevronRight,
} from 'lucide-react';
import { getUserProfile, updateUserProfile } from '../../data/user';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

interface Contact { name: string; phone: string }

export const ProfilePage = () => {
  const nav = useNavigate();
  const { user } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'main' | 'contacts' | 'sensors'>('main');

  // Profile editable state
  // Profile editable state
  const [bloodGroup, setBloodGroup] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactSaved, setContactSaved] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      getUserProfile(user.uid).then(p => {
        if (p) {
          if (p.bloodGroup) setBloodGroup(p.bloodGroup);
          if (p.contacts && p.contacts.length > 0) setContacts(p.contacts);
        }
      });
    }
  }, [user?.uid]);

  // Sensor state
  const [sample, setSample] = useState<SensorSample>({
    lat: 28.6139, lon: 77.209, speedKmh: 42, accelerationG: 0.4, orientation: 'normal', vibration: 10,
  });
  const prevRef = useRef<SensorSample | null>(null);
  const detection = useMemo(() => detectCrash(prevRef.current, sample), [sample]);

  const saveContacts = () => {
    if (user?.uid) {
      updateUserProfile(user.uid, { contacts: contacts.filter(c => c.name || c.phone) });
    }
    setContactSaved(true);
    setTimeout(() => setContactSaved(false), 2500);
  };

  const handleBloodGroupSelect = (bg: string) => {
    setBloodGroup(bg);
    if (user?.uid) {
      updateUserProfile(user.uid, { bloodGroup: bg });
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try { await logout(); nav('/'); } finally { setBusy(false); }
  };

  if (section === 'contacts') return (
    <ContactsEditor
      contacts={contacts}
      setContacts={setContacts}
      saved={contactSaved}
      onSave={saveContacts}
      onBack={() => setSection('main')}
    />
  );

  if (section === 'sensors') return (
    <SensorDashboard
      sample={sample}
      setSample={(fn) => { prevRef.current = sample; setSample(fn); }}
      detection={detection}
      onBack={() => setSection('main')}
    />
  );

  return (
    <div className="min-h-full bg-[#0a0b0f] px-4 pt-10 pb-4 max-w-lg mx-auto w-full space-y-4">
      {/* Profile card */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
            <User className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-black text-white truncate">{user?.displayName || 'Guest'}</div>
            <div className="text-xs text-white/35 flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> {user?.email?.split('@')[0] || '—'}
            </div>
          </div>
        </div>

        {/* Blood group */}
        <div className="mt-4">
          <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest flex items-center gap-1 mb-2">
            <Droplets className="h-3 w-3 text-red-400" /> Blood Group
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BLOOD_GROUPS.map(bg => (
              <button key={bg} onClick={() => handleBloodGroupSelect(bg === bloodGroup ? '' : bg)}
                className={`h-8 px-3 rounded-full text-xs font-black transition active:scale-95 ${
                  bloodGroup === bg
                    ? 'bg-red-500 text-white'
                    : 'bg-white/5 text-white/40 border border-white/10 hover:border-white/25'
                }`}>{bg}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Settings rows */}
      <div className="rounded-3xl border border-white/[0.06] bg-[#13141a] overflow-hidden divide-y divide-white/[0.04]">
        <SettingRow
          icon={<ShieldCheck className="h-4 w-4 text-blue-400" />}
          label="Emergency Contacts"
          sub={`${contacts.filter(c => c.name).length} saved`}
          onClick={() => setSection('contacts')}
          arrow
        />
        <SettingRow
          icon={<Activity className="h-4 w-4 text-emerald-400" />}
          label="Crash Detection Monitor"
          sub="Sensor diagnostics"
          onClick={() => setSection('sensors')}
          arrow
        />
        <SettingRow
          icon={<MapPin className="h-4 w-4 text-amber-400" />}
          label="Location"
          sub="Used only when needed"
        />
        <SettingRow
          icon={<Bell className="h-4 w-4 text-purple-400" />}
          label="Notifications"
          sub="Emergency alerts enabled"
        />
        {/* Dark mode toggle */}
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center">
              {theme === 'dark' ? <Moon className="h-4 w-4 text-indigo-300" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/85">Dark Mode</div>
              <div className="text-[10px] text-white/30 font-medium">{theme === 'dark' ? 'Currently dark' : 'Currently light'}</div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={[
              'relative h-7 w-12 rounded-full transition-all duration-300',
              theme === 'dark' ? 'bg-indigo-600' : 'bg-white/20',
            ].join(' ')}
          >
            <span className={[
              'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300',
              theme === 'dark' ? 'left-6' : 'left-1',
            ].join(' ')} />
          </button>
        </div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        disabled={busy}
        className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/5 text-xs font-black text-red-400 hover:bg-red-500/10 transition active:scale-95 disabled:opacity-50"
      >
        <LogOut className="h-4 w-4" /> {busy ? 'Signing out…' : 'Log Out'}
      </button>

      <p className="text-center text-[10px] text-white/15 pb-2">Arogya Raksha v1.0</p>
    </div>
  );
};

/* ── Contacts editor sub-screen ── */
const ContactsEditor = ({
  contacts, setContacts, saved, onSave, onBack,
}: {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
  saved: boolean;
  onSave: () => void;
  onBack: () => void;
}) => (
  <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
      ← Back
    </button>
    <h2 className="text-xl font-black text-white">Emergency Contacts</h2>
    <p className="text-xs text-white/35">At least 1 required. They will be notified when you trigger SOS.</p>

    {saved && (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">
        ✅ Emergency contact added successfully
      </div>
    )}

    <div className="space-y-3">
      {contacts.map((c, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.06] bg-[#13141a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Contact {i + 1}</span>
            {contacts.length > 1 && (
              <button onClick={() => setContacts(cs => cs.filter((_, j) => j !== i))}
                className="h-6 w-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition">
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <input value={c.name} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            placeholder="Contact name"
            className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
          <input value={c.phone} onChange={e => setContacts(cs => cs.map((x, j) => j === i ? { ...x, phone: e.target.value } : x))}
            placeholder="Phone number" type="tel"
            className="w-full h-10 rounded-xl border border-white/[0.06] bg-white/[0.04] px-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/30 transition" />
        </div>
      ))}

      <button onClick={() => setContacts(cs => [...cs, { name: '', phone: '' }])}
        className="w-full h-10 flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 text-xs font-semibold text-white/40 hover:border-white/30 hover:text-white/60 transition">
        <Plus className="h-3.5 w-3.5" /> Add contact
      </button>
    </div>

    <button onClick={onSave}
      className="w-full h-12 rounded-2xl text-sm font-black text-white transition active:scale-95"
      style={{ background: 'linear-gradient(135deg,#dc2626,#b91c1c)', boxShadow: '0 0 20px rgba(220,38,38,0.3)' }}>
      Save Contacts
    </button>
  </div>
);

/* ── Sensor dashboard sub-screen ── */
const SensorDashboard = ({
  sample, setSample, detection, onBack,
}: {
  sample: SensorSample;
  setSample: (fn: (s: SensorSample) => SensorSample) => void;
  detection: ReturnType<typeof detectCrash>;
  onBack: () => void;
}) => (
  <div className="min-h-full bg-[#0a0b0f] px-4 pt-6 pb-4 max-w-lg mx-auto w-full space-y-4">
    <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition mb-2">
      ← Back
    </button>
    <div className="flex items-center gap-2">
      <Activity className="h-5 w-5 text-emerald-400" />
      <h2 className="text-xl font-black text-white">Crash Detection Monitor</h2>
    </div>
    <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5 text-[10px] font-bold text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sensors Active
    </div>

    {/* AI Confidence */}
    <div className="rounded-2xl border border-white/[0.05] bg-[#13141a] p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white/60">
          <ShieldAlert className="h-3.5 w-3.5 text-white/25" /> AI Crash Confidence
        </div>
        <div className={`text-xl font-black ${detection.crashed ? 'text-red-400' : 'text-emerald-400'}`}>
          {detection.crashed ? '84%' : '0%'}
        </div>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${detection.crashed ? 'bg-red-500 w-[84%]' : 'bg-emerald-400 w-1'}`} />
      </div>
      {detection.crashed && (
        <p className="mt-2 text-[10px] text-red-300">⚠ {detection.reasons.join(', ')}</p>
      )}
    </div>

    {/* Sliders */}
    <div className="space-y-3">
      <SSlider label="Speed" unit="km/h" min={0} max={120} value={sample.speedKmh}
        onChange={v => setSample(s => ({ ...s, speedKmh: v }))} color="#3b82f6" />
      <SSlider label="G-Force" unit="G" min={0} max={4} step={0.1} value={sample.accelerationG}
        onChange={v => setSample(s => ({ ...s, accelerationG: v }))} color="#f59e0b" />
      <SSlider label="Tilt Angle" unit="°" min={0} max={180} value={sample.orientation === 'flipped' ? 180 : sample.vibration}
        onChange={v => setSample(s => ({ ...s, vibration: v, orientation: v > 90 ? 'flipped' : 'normal' }))} color="#a855f7" />
    </div>
  </div>
);

const SSlider = ({ label, unit, min, max, step = 1, value, onChange, color }: {
  label: string; unit: string; min: number; max: number; step?: number;
  value: number; onChange: (v: number) => void; color: string;
}) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-[#13141a] p-4">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-bold text-white/60">{label}</span>
        <span className="text-base font-black" style={{ color }}>
          {value.toFixed(step < 1 ? 1 : 0)} <span className="text-[10px] text-white/30">{unit}</span>
        </span>
      </div>
      <div className="relative h-2 flex items-center">
        <div className="absolute inset-0 bg-white/5 rounded-full" />
        <div className="absolute h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
        <div className="absolute h-4 w-4 rounded-full bg-white shadow-lg -translate-x-1/2" style={{ left: `${pct}%` }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </div>
    </div>
  );
};

const SettingRow = ({
  icon, label, sub, onClick, arrow,
}: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; arrow?: boolean }) => (
  <div
    onClick={onClick}
    className={['flex items-center justify-between px-4 py-3.5', onClick ? 'cursor-pointer hover:bg-white/[0.03] active:bg-white/5' : ''].join(' ')}
  >
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-sm font-semibold text-white/85">{label}</div>
        {sub && <div className="text-[10px] text-white/30 font-medium mt-0.5">{sub}</div>}
      </div>
    </div>
    {arrow && <ChevronRight className="h-4 w-4 text-white/20" />}
  </div>
);
