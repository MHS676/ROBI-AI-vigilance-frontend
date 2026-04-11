import type { Metadata } from 'next';
import LiveEventsClient from './LiveEventsClient';

export const metadata: Metadata = {
  title: 'Live Events | Falcon Intelli-Sense',
};

export default function SuperAdminLivePage() {
  return <LiveEventsClient />;
}
