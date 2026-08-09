'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'client' | 'sales' | 'hr' | 'employee' | 'crm' | 'finance')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user, hasHydrated } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setIsMounted(true);

    // The auth store rehydrates (from sessionStorage after the MED-2 change)
    // asynchronously, so isAuthenticated is briefly false on every hard
    // navigation/refresh even for a logged-in user. Wait for hasHydrated
    // before deciding - otherwise this redirects a valid session to /login
    // intermittently.
    if (!hasHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      // User is authenticated but doesn't have the right role
      const roleRedirects: Record<string, string> = {
        admin: '/admin',
        sales: '/sales',
        hr: '/hr',
        employee: '/employee',
        crm: '/crm',
        client: '/portal',
        finance: '/crm/payments',
      };
      router.replace(roleRedirects[user.role] ?? '/portal');
      return;
    }

    setIsAuthorized(true);
  }, [isAuthenticated, user, router, pathname, allowedRoles, hasHydrated]);

  // Show nothing while determining auth state on client (prevents flash of content)
  if (!isMounted || !isAuthorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F1F5F9]">
        <Loader2 className="w-8 h-8 animate-spin text-[#4C1D95]" />
      </div>
    );
  }

  return <>{children}</>;
}
