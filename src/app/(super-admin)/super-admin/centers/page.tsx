import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const CentersListClient = dynamic(() => import('@/components/dashboard/CentersListClient'), { ssr: false });

export const metadata: Metadata = {
  title: 'All Centers | Falcon Intelli-Sense',
};

export default function SuperAdminCentersPage() {
  return <CentersListClient />;
}
