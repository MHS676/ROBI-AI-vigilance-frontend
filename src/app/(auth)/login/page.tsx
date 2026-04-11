import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(#06b6d4 1px, transparent 1px), linear-gradient(90deg, #06b6d4 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow blob */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[100px] rounded-full" />

      <div className="relative w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl mb-4 shadow-lg shadow-cyan-500/10">
            <ShieldCheck className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Falcon Intelli-Sense
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            AI Surveillance Command Center
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-700/60 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <h2 className="text-base font-semibold text-white mb-6">
            Sign in to your account
          </h2>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          © {new Date().getFullYear()} Falcon Security Limited. All rights reserved.
        </p>
      </div>
    </main>
  );
}
