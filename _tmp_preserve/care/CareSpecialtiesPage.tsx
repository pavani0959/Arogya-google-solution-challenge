import React from 'react';
import { Link } from 'react-router-dom';

const SPECIALTIES = [
  { id: 'cardio', name: 'Cardiology' },
  { id: 'ortho', name: 'Orthopedics' },
  { id: 'derma', name: 'Dermatology' },
  { id: 'neuro', name: 'Neurology' },
  { id: 'peds', name: 'Pediatrics' },
  { id: 'ent', name: 'ENT' },
];

export const CareSpecialtiesPage = () => {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="text-xl font-black">Choose a specialty</div>
        <p className="mt-2 text-sm text-white/70">This starts the guided booking flow: Specialty → Doctor → Hospital → Slot.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SPECIALTIES.map((s) => (
          <Link
            key={s.id}
            to={`/app/care/doctors?specialty=${encodeURIComponent(s.id)}`}
            className="rounded-2xl border border-white/10 bg-slate-950/40 p-4 hover:bg-white/5"
          >
            <div className="text-sm font-black">{s.name}</div>
            <div className="mt-1 text-xs text-white/60">Tap to view doctors nearby</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

