import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export const CareDoctorsPage = () => {
  const [params] = useSearchParams();
  const specialty = params.get('specialty') || 'cardio';

  const doctors = [
    { id: 'd1', name: 'Dr. Meera Patel', specialty: 'cardio', rating: 4.8 },
    { id: 'd2', name: 'Dr. Rahul Gupta', specialty: 'ortho', rating: 4.7 },
    { id: 'd3', name: 'Dr. Sunita Rao', specialty: 'derma', rating: 4.6 },
  ].filter((d) => d.specialty === specialty);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Choose a doctor</div>
        <p className="mt-2 text-sm text-white/70">
          Specialty selected: <span className="font-semibold text-white">{specialty}</span>
        </p>
      </div>

      <div className="grid gap-3">
        {(doctors.length ? doctors : [{ id: 'x', name: 'Dr. Dummy', specialty, rating: 4.5 }]).map((d) => (
          <Link
            key={d.id}
            to={`/app/care/hospitals?specialty=${encodeURIComponent(specialty)}&doctor=${encodeURIComponent(d.id)}`}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:bg-white/5"
          >
            <div>
              <div className="text-sm font-black">{d.name}</div>
              <div className="mt-1 text-xs text-white/60">
                Rating {d.rating} • Availability + fees will come from Firestore
              </div>
            </div>
            <div className="text-xs font-semibold text-white/70">Select →</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

