import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const AdminLiveClient = dynamic(() => import('./AdminLiveClient'), { ssr: false });

export const metadata: Metadata = {
  title: 'Live Events | Falcon Intelli-Sense',
};

export default function AdminLivePage() {
  return <AdminLiveClient />;
}
