import type { Metadata } from 'next';
import SuperAdminDashboardClient from './SuperAdminDashboardClient';

export const metadata: Metadata = { title: 'Command Center' };

/**
 * Server component shell — renders the interactive client dashboard.
 * All real-time socket logic lives in SuperAdminDashboardClient ('use client').
 */
export default function SuperAdminDashboardPage() {
  return <SuperAdminDashboardClient />;
}
