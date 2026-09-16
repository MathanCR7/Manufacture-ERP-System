import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/axios';

const initialCompanyState = {
  companyName: '',
  companyAddress: '',
  companyGstin: '',
  companyPan: '',
  companyMobile: '',
  collectTax: 'Yes',
  taxRegNo: '',
  taxType: 'Exclusive Tax',
  taxes: [
    { name: 'CGST', rate: '9.00' },
    { name: 'SGST', rate: '9.00' },
    { name: 'IGST', rate: '18.00' }
  ]
};

const useCompanyStore = create(
  persist(
    (set, get) => ({
      company: initialCompanyState,
      loading: false,
      error: null,

      fetchCompany: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.get('/setup/tax');
          if (res.data) {
            set({
              company: {
                ...initialCompanyState,
                ...res.data
              },
              loading: false
            });
            return res.data;
          }
        } catch (err) {
          console.error('[companyStore] Failed to fetch company settings:', err);
          set({ loading: false, error: err.message });
        }
        return get().company;
      },

      updateCompany: async (newDetails) => {
        set({ loading: true, error: null });
        try {
          const res = await api.post('/setup/tax', newDetails);
          const updated = res.data?.settings || newDetails;
          set({
            company: {
              ...initialCompanyState,
              ...updated
            },
            loading: false
          });
          return { success: true, settings: updated };
        } catch (err) {
          console.error('[companyStore] Failed to save company settings to database:', err);
          set({ loading: false, error: err.message });
          throw err;
        }
      },

      setCompany: (newDetails) => {
        set((state) => ({
          company: {
            ...state.company,
            ...newDetails
          }
        }));
      }
    }),
    {
      name: 'erp-company-settings-v2'
    }
  )
);

export default useCompanyStore;
