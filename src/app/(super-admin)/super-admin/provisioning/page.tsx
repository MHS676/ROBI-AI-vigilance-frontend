import dynamic from 'next/dynamic';

const ProvisioningClient = dynamic(() => import('./ProvisioningClient'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-slate-500 text-sm">
      Loading…
    </div>
  ),
});

export default function ProvisioningPage() {
  return <ProvisioningClient />;
}
