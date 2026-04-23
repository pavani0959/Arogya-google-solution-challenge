import { Link } from 'react-router-dom';
import { HeartPulse, Bone, Search, Brain, Baby, Stethoscope } from 'lucide-react';

const SPECIALTIES = [
  { id: 'cardio', name: 'Cardiology', icon: <HeartPulse className="h-5 w-5" />, color: 'emerald' },
  { id: 'ortho', name: 'Orthopedics', icon: <Bone className="h-5 w-5" />, color: 'blue' },
  { id: 'derma', name: 'Dermatology', icon: <Search className="h-5 w-5" />, color: 'amber' },
  { id: 'neuro', name: 'Neurology', icon: <Brain className="h-5 w-5" />, color: 'violet' },
  { id: 'peds', name: 'Pediatrics', icon: <Baby className="h-5 w-5" />, color: 'rose' },
  { id: 'ent', name: 'ENT', icon: <Stethoscope className="h-5 w-5" />, color: 'cyan' },
];

export const CareSpecialtiesPage = () => {
  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full pb-12 space-y-4">
      <div className="w-full rounded-3xl border border-white/8 bg-[#13141a] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl opacity-50" />
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
          <Stethoscope className="h-3.5 w-3.5 text-emerald-400" /> Medical Care
        </div>
        <div className="text-3xl font-black tracking-tight text-white mb-2">Specialties</div>
        <p className="text-xs text-white/40 font-medium">
          Choose a specialty to find the best doctors and hospitals nearby.
        </p>
      </div>

      <div className="w-full grid gap-3 sm:grid-cols-2">
        {SPECIALTIES.map((s) => (
          <Link
            key={s.id}
            to={`/app/care/doctors?specialty=${encodeURIComponent(s.id)}`}
            className="group flex flex-col items-start gap-4 rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg transition hover:bg-white/[0.04]"
          >
            <div className={`p-3 rounded-2xl bg-${s.color}-500/10 text-${s.color}-400 group-hover:bg-${s.color}-500/20 transition`}>
              {s.icon}
            </div>
            <div>
              <div className="text-sm font-black text-white/90">{s.name}</div>
              <div className="mt-1 text-[10px] uppercase font-bold text-white/30 tracking-wider">
                Find experts →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
