import type { Metadata } from 'next';
import MappingPageClient from './MappingPageClient';

export const metadata: Metadata = {
  title: 'Hardware Mapping | Falcon Intelli-Sense',
  description: 'Draw camera bounding boxes and link table zones to microphones and agents.',
};

/**
 * Hardware Mapping page — /super-admin/mapping
 *
 * Server shell: renders a 'use client' orchestrator component.
 * Konva canvas is loaded via dynamic import (ssr: false) inside the client.
 */
export default function MappingPage() {
  return <MappingPageClient />;
}
