import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const getRedirectPathByRole = (role) => {
  switch (role) {
    case 'MAIN_MASTER':
    case 'SUPERVISOR':
      return '/dashboard';
    case 'PURCHASE_ACCOUNTANT':
      return '/dashboard/finance';
    case 'MATERIALS_RECEIVER':
      return '/dashboard/inventory';
    case 'LAB_ASSISTANT':
      return '/dashboard/lab';
    case 'PRODUCTION_STAFF':
      return '/dashboard/production';
    case 'SALES_TEAM':
      return '/dashboard/sales';
    default:
      return '/dashboard';
  }
};

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'leonex-auth' }
  )
);

export default useAuthStore;
