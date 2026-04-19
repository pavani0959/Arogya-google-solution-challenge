import { Outlet } from 'react-router-dom';
import { GlobalSosWatcher } from './GlobalSosWatcher';

export const RootLayout = () => {
  return (
    <>
      <GlobalSosWatcher />
      <Outlet />
    </>
  );
};
