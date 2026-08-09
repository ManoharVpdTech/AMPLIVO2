import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: 'admin' | 'client' | 'sales' | 'hr' | 'employee' | 'crm' | 'finance';
  company?: string;
  image?: string;
  is_active?: boolean;
  is_verified?: boolean;
  phone?: string;
  extension?: string;
  designation?: string;
  signature?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // Zustand's persist middleware rehydrates from localStorage
  // asynchronously after the initial render, so isAuthenticated is always
  // false for one tick on a hard page load. Consumers that gate a redirect
  // on isAuthenticated (e.g. ProtectedRoute) must wait for hasHydrated -
  // otherwise every hard navigation/refresh has a race that can bounce a
  // logged-in user back to /login.
  hasHydrated: boolean;
  login: (user: User, token: string, refreshToken?: string) => void;
  logout: () => void;
  setToken: (token: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,
      login: (user, token, refreshToken = undefined) =>
        set({ user, token, refreshToken, isAuthenticated: true }),
      logout: () => {
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        // Other persisted Zustand stores (crmStore's selected-lead/client/
        // project ids, hrStore's cached state) must not survive a logout -
        // otherwise the next person to use this browser/device inherits the
        // previous user's leftover UI state.
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('amplivo-crm-store');
          window.localStorage.removeItem('amplivo-hr-storage');
        }
      },
      setToken: (token) => set({ token }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      updateUser: (patch) => set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),
    }),
    {
      name: 'auth-storage',
      // MED-2: persist tokens to sessionStorage, NOT localStorage. A JWT that
      // lives in localStorage survives the browser tab and is readable by any
      // script on the same origin indefinitely; sessionStorage bounds it to
      // the current tab and clears it when the tab closes, shrinking the
      // stolen-token window on shared machines.
      storage: createJSONStorage(() => sessionStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
