import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const AlertsClient = dynamic(() => import('@/components/admin/AlertsClient'), { ssr: false });

export const metadata: Metadata = {
  title: 'Evidence Dashboard | Falcon Intelli-Sense',
  description: 'Historical AI and sensor alert records with evidence frames',
};

export default function AlertsPage() {
  return <AlertsClient />;
}
