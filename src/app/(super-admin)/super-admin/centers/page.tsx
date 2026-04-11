import type { Metadata } from 'next';
import CentersListClient from '@/components/dashboard/CentersListClient';

export const metadata: Metadata = {
  title: 'All Centers | Falcon Intelli-Sense',
};

export default function SuperAdminCentersPage() {
  return <CentersListClient />;
}
