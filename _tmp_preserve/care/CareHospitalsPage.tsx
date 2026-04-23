import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export const CareHospitalsPage = () => {
  const [params] = useSearchParams();
  const specialty = params.get('specialty') || 'cardio';
  const doctor = params.get('doctor') || 'd1';

  const hospitals = [
    { id: 'h1', name: 'AIIMS Delhi', distanceKm: 2.1 },
    { id: 'h2', name: 'Apollo Hospital', distanceKm: 3.8 },
    { id: 'h3', name: 'KGMU Lucknow', distanceKm: 5.4 },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Choose a hospital</div>
        <p className="mt-2 text-sm text-white/70">
          We’ll show hospitals near you that can handle <span className="font-semibold text-white">{specialty}</span>.
        </p>
      </div>

      <div className="grid gap-3">
        {hospitals.map((h) => (
          <Link
            key={h.id}
            to={`/app/care/book?specialty=${encodeURIComponent(specialty)}&doctor=${encodeURIComponent(doctor)}&hospital=${encodeURIComponent(h.id)}`}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:bg-white/5"
          >
            <div>
              <div className="text-sm font-black">{h.name}</div>
              <div className="mt-1 text-xs text-white/60">{h.distanceKm} km • ETA and departments will be real data</div>
            </div>
            <div className="text-xs font-semibold text-white/70">Select →</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

