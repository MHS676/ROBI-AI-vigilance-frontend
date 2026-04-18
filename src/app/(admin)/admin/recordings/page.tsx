import type { Metadata } from 'next';
import RecordingsClient from './RecordingsClient';

export const metadata: Metadata = {
  title: 'Recordings | Falcon',
};

export default function RecordingsPage() {
  return <RecordingsClient />;
}
