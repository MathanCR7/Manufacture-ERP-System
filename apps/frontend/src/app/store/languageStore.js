import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useLanguageStore = create(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (lang) => {
        set({ language: lang });
        // We will trigger Google Translate change from here or AppShell
      },
    }),
    { name: 'language-storage' }
  )
);

export default useLanguageStore;
