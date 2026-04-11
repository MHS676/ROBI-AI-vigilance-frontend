import type { Metadata } from 'next';
import TablesPage from '@/components/hardware/TablesPage';

export const metadata: Metadata = {
  title: 'Tables | Falcon Intelli-Sense',
};

export default function AdminTablesPage() {
  return <TablesPage />;
}
