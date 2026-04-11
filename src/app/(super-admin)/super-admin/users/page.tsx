import type { Metadata } from 'next';
import UsersPageClient from './UsersPageClient';

export const metadata: Metadata = { title: 'User Management — Falcon Security' };

export default function UsersPage() {
  return <UsersPageClient />;
}
