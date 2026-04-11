import type { Metadata } from 'next';
import NewCenterClient from './NewCenterClient';

export const metadata: Metadata = {
  title: 'Register Center | Falcon Intelli-Sense',
};

export default function NewCenterPage() {
  return <NewCenterClient />;
}
