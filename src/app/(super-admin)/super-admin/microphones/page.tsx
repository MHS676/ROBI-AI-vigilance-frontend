import type { Metadata } from 'next';
import MicrophonesPage from '@/components/hardware/MicrophonesPage';

export const metadata: Metadata = {
  title: 'Microphones | Falcon Intelli-Sense',
};

export default function SuperAdminMicrophonesPage() {
  return <MicrophonesPage />;
}
