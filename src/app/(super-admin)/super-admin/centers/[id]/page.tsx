import type { Metadata } from 'next';
import CenterDetailClient from './CenterDetailClient';

export const metadata: Metadata = { title: 'Center Detail — Falcon Security' };

export default function CenterDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { setup?: string };
}) {
  return (
    <CenterDetailClient
      centerId={params.id}
      setupMode={searchParams.setup === 'true'}
    />
  );
}
