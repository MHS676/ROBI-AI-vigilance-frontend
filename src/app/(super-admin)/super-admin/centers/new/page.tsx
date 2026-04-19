import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const NewCenterClient = dynamic(() => import('./NewCenterClient'), { ssr: false });

export const metadata: Metadata = {
  title: 'Register Center | Falcon Intelli-Sense',
};

export default function NewCenterPage() {
  return <NewCenterClient />;
}
