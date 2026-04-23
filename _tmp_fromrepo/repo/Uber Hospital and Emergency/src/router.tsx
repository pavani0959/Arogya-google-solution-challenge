
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LandingPage } from './screens/public/LandingPage';
import { LoginPage } from './screens/public/LoginPage';
import { SignupPage } from './screens/public/SignupPage';
import { AppShell } from './shell/AppShell';
import { DashboardPage } from './screens/app/DashboardPage';
import { HelpPage } from './screens/app/HelpPage';
import { ProfilePage } from './screens/app/ProfilePage';
import { SosPage } from './screens/app/SosPage';
import { DoctorPortalPage } from './screens/portals/DoctorPortalPage';
import { HospitalPortalPage } from './screens/portals/HospitalPortalPage';
import { AdminPanel } from './screens/admin/AdminPanel';
import { NotFoundPage } from './screens/NotFoundPage';
import { RootLayout } from './shell/RootLayout';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      // ── Public / auth
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },

      // ── Full-screen emergency (no shell, no nav)
      { path: 'app/sos', element: <SosPage /> },
      { path: 'admin', element: <AdminPanel /> },

      // ── Main app with bottom nav
      {
        path: 'app',
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },       // 🏠 Home tab
          { path: 'help', element: <HelpPage /> },            // 🤝 Help tab
          { path: 'profile', element: <ProfilePage /> },      // 👤 Profile tab

          // legacy redirects so old links don't 404
          { path: 'settings', element: <Navigate to="/app/profile" replace /> },
          { path: 'helper', element: <Navigate to="/app/help" replace /> },
        ],
      },

      // ── Portals
      { path: 'doctor', element: <DoctorPortalPage /> },
      { path: 'hospital', element: <HospitalPortalPage /> },

      // ── Fallback
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
