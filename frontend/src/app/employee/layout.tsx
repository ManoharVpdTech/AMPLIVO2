'use client';

import { useEffect, useState } from 'react';
import { EmployeeSidebar } from '@/components/employee/EmployeeSidebar';
import { PageTransition } from '@/components/PageTransition';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCrmStore } from '@/store/crmStore';
import { useAuthStore } from '@/store/authStore';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, activeEmployeeId, setActiveEmployee, fetchAllData, fetchEmployees } = useCrmStore();
  const user = useAuthStore(state => state.user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // The employee's identity is the real authenticated user's UUID - it
    // must match `assigned_to`/`submitted_by` on the backend's tasks and
    // task_submissions rows exactly, so no mock-employee lookup or
    // placeholder id (e.g. 'EMP-001') can stand in for it.
    if (user?.id && activeEmployeeId !== user.id) {
      setActiveEmployee(user.id);
    }
  }, [user, activeEmployeeId, setActiveEmployee]);

  useEffect(() => {
    // Real tasks/projects (fetchAllData) and real employee records
    // (fetchEmployees) - the mock arrays these replace only exist as the
    // store's pre-fetch initial state and must never reach the UI.
    // skipFinance: true - the Employee portal never renders invoices/
    // payments, and GET /finance/payments is finance-role-gated, so
    // fetching it here only produced repeated console 403s.
    fetchAllData({ skipFinance: true });
    fetchEmployees();
  }, [fetchAllData, fetchEmployees]);

  const isDark = mounted && theme === 'dark';

  return (
    <ProtectedRoute allowedRoles={['admin', 'employee']}>
      {isDark && (
        <style dangerouslySetInnerHTML={{__html: `
          .bg-white { background-color: #1e293b !important; }
          .bg-\\[\\#F8FAFC\\] { background-color: #0f172a !important; }
          .text-slate-900, .text-indigo-900, .text-slate-800 { color: #f8fafc !important; }
          .text-slate-700 { color: #e2e8f0 !important; }
          .text-slate-500, .text-slate-600 { color: #94a3b8 !important; }
          .border-slate-200, .border-slate-300, .border-indigo-100 { border-color: #334155 !important; }
          .border-slate-100 { border-color: #1e293b !important; }
          .bg-slate-50, .bg-indigo-50\\/50 { background-color: #1e293b !important; }
          input, select, textarea { 
            background-color: #1e293b !important; 
            color: #f8fafc !important; 
            border-color: #334155 !important;
          }
        `}} />
      )}
      <div className={`flex h-screen ${isDark ? 'bg-[#0f172a]' : 'bg-[#F8FAFC]'}`}>
        <EmployeeSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </div>
    </ProtectedRoute>
  );
}
