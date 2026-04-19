import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

const UsersPageClient = dynamic(() => import('./UsersPageClient'), { ssr: false });

export const metadata: Metadata = { title: 'User Management — Falcon Security' };

export default function UsersPage() {
  return <UsersPageClient />;
}
