import React, { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { listenAppointments, removeAppointment, type Appointment } from '../../data/appointments';

export const AppointmentsPage = () => {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = listenAppointments(user.uid, (data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user, ready]);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="text-xl font-black">Appointments</div>
      <p className="mt-2 text-sm text-white/70">Created via Care booking (or assistant). Stored in Firestore (or demo local storage).</p>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!user && ready && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white/70">
          Log in (or enable demo mode) to see appointments.
        </div>
      )}

      {loading ? (
        <div className="mt-4 text-sm text-white/60">Loading…</div>
      ) : (
        <div className="mt-4 grid gap-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white/70">
              No appointments yet.
            </div>
          ) : (
            items.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div>
                  <div className="text-sm font-black">{a.reason}</div>
                  <div className="mt-1 text-xs text-white/60">
                    {a.startAt.toLocaleString()} • status: {a.status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await removeAppointment(a.id);
                    setItems((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                  className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

