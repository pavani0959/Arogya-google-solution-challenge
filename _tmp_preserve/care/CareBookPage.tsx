import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { createAppointment } from '../../../data/appointments';

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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-xl font-black">Pick a slot</div>
      <p className="mt-2 text-sm text-white/70">
        MVP: pick a slot and we create an appointment (Firestore when configured, otherwise local demo storage).
      </p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 text-sm text-white/70">
        <div>specialty: {specialty}</div>
        <div>doctor: {doctor}</div>
        <div>hospital: {hospital}</div>
      </div>

      <div className="mt-5 grid gap-3">
        {err && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{err}</div>}
        {ok && <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">{ok}</div>}

        <div className="grid gap-2">
          <div className="text-xs font-semibold text-white/70">Available slots</div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelected(s.key)}
                className={[
                  'rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-white/10 transition',
                  selected === s.key ? 'bg-white text-slate-950' : 'bg-white/5 text-white/80 hover:bg-white/10',
                ].join(' ')}
              >
                {s.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </button>
            ))}
          </div>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-white/70">Reason *</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm outline-none focus:ring-2 focus:ring-violet-400/40"
            placeholder="e.g. chest pain, routine checkup, knee pain"
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="mt-1 h-11 rounded-2xl bg-white px-5 text-sm font-black text-slate-950 hover:bg-white/90 disabled:opacity-60"
        >
          {busy ? 'Booking…' : 'Confirm booking'}
        </button>
      </div>
    </div>
  );
};

