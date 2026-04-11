import type { Metadata } from 'next';
import AdminLiveClient from './AdminLiveClient';

export const metadata: Metadata = {
  title: 'Live Events | Falcon Intelli-Sense',
};

export default function AdminLivePage() {
  return <AdminLiveClient />;
}
