import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '@/app/store/authStore';

const RoleGuard = ({ allowedRoles }) => {
  const user = useAuthStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />; // or an unauthorized page
  }

  return <Outlet />;
};

export default RoleGuard;
