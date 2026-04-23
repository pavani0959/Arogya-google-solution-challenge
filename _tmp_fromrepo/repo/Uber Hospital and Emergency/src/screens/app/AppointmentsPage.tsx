import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { listenAppointments, removeAppointment, type Appointment } from '../../data/appointments';
import { CalendarClock, Trash2, CalendarHeart } from 'lucide-react';

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
    <div className="flex flex-col items-center max-w-lg mx-auto w-full pb-12 space-y-4">
      {/* Header */}
      <div className="w-full rounded-3xl border border-white/8 bg-[#13141a] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl opacity-50" />
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
          <CalendarClock className="h-3.5 w-3.5 text-amber-400" /> Bookings
        </div>
        <div className="text-3xl font-black tracking-tight text-white mb-2">Appointments</div>
        <p className="text-xs text-white/40 font-medium">
          Manage your upcoming hospital and doctor visits.
        </p>
      </div>

      <div className="w-full rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg">
        {error && (
          <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
            {error}
          </div>
        )}

        {!user && ready ? (
          <div className="rounded-2xl flex items-center justify-center border border-white/5 bg-white/[0.02] p-8 text-xs text-white/50 text-center">
            Log in (or enable demo mode) to see appointments.
          </div>
        ) : loading ? (
          <div className="text-xs text-white/40 text-center py-6">Loading appointments…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-white/40 text-center py-8 flex flex-col items-center">
            <CalendarHeart className="h-8 w-8 text-white/10 mb-3" />
            No upcoming appointments yet. <br /> Explore the Care tab to book one.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div key={a.id} className="group flex items-start justify-between gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]">
                <div>
                  <div className="text-sm font-bold text-white/90">{a.reason}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider bg-amber-500/10 px-2 py-0.5 rounded-full">
                      {a.status}
                    </span>
                    <span className="text-[10px] text-white/40 font-medium tracking-wide">
                      {a.startAt.toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await removeAppointment(a.id);
                    setItems((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                  className="rounded-full bg-white/5 p-2 text-white/30 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Cancel appointment"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
