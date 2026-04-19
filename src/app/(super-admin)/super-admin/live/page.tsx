import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const LiveEventsClient = dynamic(() => import('./LiveEventsClient'), { ssr: false });

export const metadata: Metadata = {
  title: 'Live Events | Falcon Intelli-Sense',
};

export default function SuperAdminLivePage() {
  return <LiveEventsClient />;
}
