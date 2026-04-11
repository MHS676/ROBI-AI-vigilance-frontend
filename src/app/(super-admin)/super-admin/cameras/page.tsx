import type { Metadata } from 'next';
import CamerasPage from '@/components/hardware/CamerasPage';

export const metadata: Metadata = {
  title: 'Cameras | Falcon Intelli-Sense',
};

export default function SuperAdminCamerasPage() {
  return <CamerasPage />;
}
