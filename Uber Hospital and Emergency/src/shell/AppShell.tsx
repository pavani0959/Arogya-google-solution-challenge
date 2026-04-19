import React, { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, HandHeart, User } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { listenCurrentSosRequest, type SosRequestDoc } from '../data/sos';
import { useLiveLocationTracking } from '../hooks/useLiveLocationTracking';

export const AppShell = () => {
  const { user } = useAuth();
  const [request, setRequest] = useState<SosRequestDoc | null>(null);

  useEffect(() => {
    if (!user) return;
    return listenCurrentSosRequest(user.uid, setRequest);
  }, [user]);

  // Track if they don't have an SOS, or if they have an active/countdown SOS.
  // Stop tracking if SOS is specifically resolved or cancelled.
  const isSosCompleted = request?.status === 'resolved' || request?.status === 'cancelled';
  const shouldTrack = !isSosCompleted;
  
  useLiveLocationTracking(shouldTrack);

  return (
    <div className="min-h-dvh bg-[#0a0b0f] dark:bg-[#0a0b0f] light:bg-gray-50 flex flex-col">
      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-[72px]">
        <Outlet />
      </main>

      {/* Bottom Nav — 3 tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-50 h-[72px] border-t border-white/[0.06] dark:bg-[#0e0f14]/95 bg-white/95 backdrop-blur-xl">
        <div className="grid grid-cols-3 h-full max-w-lg mx-auto">
          <BottomTab to="/app" label="Home" icon={<Home className="h-5 w-5" />} end />
          <BottomTab to="/app/help" label="Help" icon={<HandHeart className="h-5 w-5" />} />
          <BottomTab to="/app/profile" label="Profile" icon={<User className="h-5 w-5" />} />
        </div>
      </nav>
    </div>
  );
};

const BottomTab = ({
  to, label, icon, end,
}: { to: string; label: string; icon: React.ReactNode; end?: boolean }) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) =>
      [
        'flex flex-col items-center justify-center gap-1 transition-all',
        isActive
          ? 'text-red-500 dark:text-red-400'
          : 'text-white/35 dark:text-white/35 hover:text-white/70',
      ].join(' ')
    }
  >
    {({ isActive }) => (
      <>
        <span className={['p-1.5 rounded-xl transition-all', isActive ? 'bg-red-500/12' : ''].join(' ')}>
          {icon}
        </span>
        <span className="text-[10px] font-bold tracking-wide">{label}</span>
      </>
    )}
  </NavLink>
);
