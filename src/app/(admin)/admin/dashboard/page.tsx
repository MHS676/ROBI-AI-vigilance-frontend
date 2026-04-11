import type { Metadata } from 'next';
import AdminDashboardClient from './AdminDashboardClient';

export const metadata: Metadata = {
  title: 'Center Dashboard | Falcon Intelli-Sense',
  description: 'Real-time live video and table status monitoring for your assigned center.',
};

/**
 * Admin Dashboard — /admin/dashboard
 *
 * Server shell: the real work happens in AdminDashboardClient ('use client').
 * The layout uses h-screen / flex-1 so the 60/40 split fills available height.
 */
export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
