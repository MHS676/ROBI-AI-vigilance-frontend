import AdminSidebar from '@/components/layouts/AdminSidebar';
import TopNav from '@/components/layouts/TopNav';

/**
 * Layout wrapper for all /admin/* routes.
 * Available to SUPER_ADMIN, ADMIN and AGENT roles.
 * The sidebar only shows the current user's assigned center.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar — shows this admin's single center */}
      <AdminSidebar />

      {/* Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-hidden p-6 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
