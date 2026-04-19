import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { createAppointment } from '../../../data/appointments';
import { CalendarDays, Clock, FileText, CheckCircle2, User, Building2, Stethoscope } from 'lucide-react';

export const CareBookPage = () => {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const specialty = params.get('specialty') || '';
  const doctor = params.get('doctor') || '';
  const hospital = params.get('hospital') || '';

  const slots = useMemo(() => {
    const base = new Date();
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 2);
    return Array.from({ length: 6 }).map((_, i) => {
      const start = new Date(base.getTime() + i * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return { start, end, key: start.toISOString() };
    });
  }, []);

  const [selected, setSelected] = useState(slots[0]?.key ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const selectedSlot = slots.find((s) => s.key === selected);

  const confirm = async () => {
    setErr(null);
    setOk(null);
    if (!selectedSlot) {
      setErr('Please select a time slot.');
      return;
    }
    if (!user) {
      setErr('Please log in (or enable demo mode) to confirm.');
      return;
    }
    if (!reason.trim()) {
      setErr('Please add a short reason (symptoms or purpose).');
      return;
    }

    setBusy(true);
    try {
      await createAppointment({
        patientId: user.uid,
        doctorId: doctor || 'doctor-demo',
        hospitalId: hospital || 'hospital-demo',
        startAt: selectedSlot.start,
        endAt: selectedSlot.end,
        reason: reason.trim(),
        status: 'scheduled',
      });
      setOk('Appointment booked! ✅');
      setTimeout(() => nav('/app/appointments'), 700);
    } catch (e: any) {
      setErr(e?.message || 'Failed to book appointment.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full pb-12 space-y-4">
      {/* Header */}
      <div className="w-full rounded-3xl border border-white/8 bg-[#13141a] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl opacity-50" />
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
          <CalendarDays className="h-3.5 w-3.5 text-emerald-400" /> Book Appointment
        </div>
        <div className="text-3xl font-black tracking-tight text-white mb-2">Pick a slot</div>
        <p className="text-xs text-white/40 font-medium">
          Select an available time and confirm your booking.
        </p>
      </div>

      {/* Summary Card */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-emerald-500/10 p-2 text-emerald-400"><Stethoscope className="h-4 w-4" /></div>
          <div>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Specialty</div>
            <div className="text-sm font-semibold text-white/90 capitalize">{specialty || 'General'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-blue-500/10 p-2 text-blue-400"><User className="h-4 w-4" /></div>
          <div>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Doctor</div>
            <div className="text-sm font-semibold text-white/90">{doctor === 'd1' ? 'Dr. Meera Patel' : doctor === 'd2' ? 'Dr. Rahul Gupta' : 'Selected Doctor'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-amber-500/10 p-2 text-amber-400"><Building2 className="h-4 w-4" /></div>
          <div>
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Hospital</div>
            <div className="text-sm font-semibold text-white/90">{hospital === 'h1' ? 'AIIMS Delhi' : 'Selected Hospital'}</div>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg space-y-5">
        {err && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-[11px] font-bold text-rose-300 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {err}
          </div>
        )}
        {ok && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[11px] font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> {ok}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelected(s.key)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
                  selected === s.key
                    ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                {s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Reason for visit</label>
          <div className="relative">
            <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-12 rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-10 pr-4 text-sm text-white outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 transition"
              placeholder="e.g. chest pain, routine checkup"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="w-full h-12 rounded-full bg-emerald-500 text-sm font-black text-white shadow-[0_0_25px_rgba(16,185,129,0.35)] transition hover:bg-emerald-400 hover:shadow-[0_0_35px_rgba(16,185,129,0.5)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {busy ? 'Booking…' : 'Confirm booking'}
        </button>
      </div>
    </div>
  );
};
