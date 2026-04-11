import type { Metadata } from 'next';
import EspNodesPage from '@/components/hardware/EspNodesPage';

export const metadata: Metadata = {
  title: 'ESP Nodes | Falcon Intelli-Sense',
};

export default function SuperAdminEspNodesPage() {
  return <EspNodesPage />;
}
