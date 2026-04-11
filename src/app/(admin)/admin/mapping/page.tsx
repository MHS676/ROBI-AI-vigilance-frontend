import type { Metadata } from 'next';
import MappingPageClient from '@/app/(super-admin)/super-admin/mapping/MappingPageClient';

export const metadata: Metadata = {
  title: 'Hardware Mapping | Falcon Intelli-Sense',
  description: 'Draw camera bounding boxes and link table zones to microphones and agents.',
};

export default function AdminMappingPage() {
  return <MappingPageClient />;
}
