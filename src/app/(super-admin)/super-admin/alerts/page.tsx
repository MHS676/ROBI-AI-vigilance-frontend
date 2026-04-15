import type { Metadata } from 'next';
import AlertsClient from '@/components/admin/AlertsClient';

export const metadata: Metadata = {
  title: 'Evidence Dashboard | Falcon Intelli-Sense',
  description: 'Historical AI and sensor alert records with evidence frames',
};

export default function AlertsPage() {
  return <AlertsClient />;
}
