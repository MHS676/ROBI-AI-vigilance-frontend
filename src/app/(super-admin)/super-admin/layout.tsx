import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import SuperAdminSidebar from '@/components/layouts/SuperAdminSidebar';
import TopNav from '@/components/layouts/TopNav';

/**
 * Layout wrapper for all /super-admin/* routes.
 *
 * Guard: the Edge middleware is the primary RBAC guard.
 * This server-side check is a defence-in-depth fallback
 * (e.g. if middleware is bypassed in dev with mocked headers).
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware injects x-user-role on authenticated requests
  const role = headers().get('x-user-role');

  // Defence-in-depth: hard redirect if a non-super-admin reaches this layout
  if (role && role !== 'SUPER_ADMIN') {
    redirect('/admin/dashboard');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar — renders all 105 centers */}
      <SuperAdminSidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
