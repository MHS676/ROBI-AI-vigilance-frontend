import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const AdminDashboardClient = dynamic(() => import('./AdminDashboardClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Loading…
    </div>
  ),
});

export const metadata: Metadata = {
  title: 'Center Dashboard | Falcon Intelli-Sense',
  description: 'Real-time live video and table status monitoring for your assigned center.',
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
