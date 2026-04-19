import { Link, useSearchParams } from 'react-router-dom';
import { User, Star, ChevronRight, Stethoscope } from 'lucide-react';

export const CareDoctorsPage = () => {
  const [params] = useSearchParams();
  const specialty = params.get('specialty') || 'cardio';

  const doctors = [
    { id: 'd1', name: 'Dr. Meera Patel', specialty: 'cardio', rating: 4.8, exp: '12 yrs' },
    { id: 'd2', name: 'Dr. Rahul Gupta', specialty: 'ortho', rating: 4.7, exp: '15 yrs' },
    { id: 'd3', name: 'Dr. Sunita Rao', specialty: 'derma', rating: 4.6, exp: '8 yrs' },
  ].filter((d) => d.specialty === specialty);

  const displaySpecs = doctors.length ? doctors : [{ id: 'x', name: 'Dr. Dummy', specialty, rating: 4.5, exp: '5 yrs' }];

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full pb-12 space-y-4">
      <div className="w-full rounded-3xl border border-white/8 bg-[#13141a] p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl opacity-50" />
        <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1">
          <Stethoscope className="h-3.5 w-3.5 text-emerald-400" /> Medical Care
        </div>
        <div className="text-3xl font-black tracking-tight text-white mb-2">Select a Doctor</div>
        <p className="text-xs text-white/40 font-medium capitalize">
          Specialty: <span className="text-white/80 font-bold">{specialty}</span>
        </p>
      </div>

      <div className="w-full space-y-3">
        {displaySpecs.map((d) => (
          <Link
            key={d.id}
            to={`/app/care/hospitals?specialty=${encodeURIComponent(specialty)}&doctor=${encodeURIComponent(d.id)}`}
            className="group flex flex-col gap-3 rounded-3xl border border-white/5 bg-[#13141a] p-5 shadow-lg transition hover:bg-white/[0.04]"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <User className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-black text-white/90 truncate">{d.name}</div>
                <div className="flex items-center gap-3 mt-1 text-[10px] uppercase font-bold text-white/40 tracking-widest">
                  <span className="flex items-center gap-1 text-amber-400"><Star className="h-3 w-3 fill-current" /> {d.rating}</span>
                  <span>{d.exp} Exp</span>
                </div>
              </div>
              <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-white/30 group-hover:bg-emerald-500 group-hover:text-white transition">
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};
