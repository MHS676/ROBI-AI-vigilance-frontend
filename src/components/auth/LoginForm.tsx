'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

// ─── Validation ───────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginForm() {
  const { login, loginError, isLoggingIn } = useAuth();
  const [showPw, setShowPw] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginFormData) => login(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      {/* Email */}
      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="operator@falconsecurity.com"
        error={errors.email?.message}
        {...register('email')}
      />

      {/* Password */}
      <div className="relative">
        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-9 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={showPw ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      {/* API error banner */}
      {loginError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"
        >
          <span className="shrink-0 mt-px">⚠</span>
          <span>{loginError}</span>
        </div>
      )}

      {/* Submit */}
      <Button
        type="submit"
        className="w-full mt-2"
        isLoading={isLoggingIn}
        loadingText="Signing in…"
        icon={<LogIn className="w-4 h-4" />}
      >
        Sign In
      </Button>
    </form>
  );
}
