'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Code2,
  Upload,
  X,
  Loader2,
  CheckCircle2,
  ImageIcon,
} from 'lucide-react';
import { centersApi } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({
  label,
  required,
  children,
  hint,
  error,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-slate-600">{hint}</p>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Input ─────────────────────────────────────────────────────────────────────
function Input({
  value,
  onChange,
  placeholder,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={cn(
        'h-10 px-3 bg-slate-800 border rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors',
        error ? 'border-red-500/60' : 'border-slate-700',
      )}
      {...rest}
    />
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────
interface FormState {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
}

const CODE_RE = /^FAL-[A-Z]{3}-\d{3}$/;

export default function NewCenterClient() {
  const router = useRouter();

  const [form, setForm] = useState<FormState>({
    name: '', code: '', address: '', city: '',
    state: '', country: 'Nigeria', phone: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [mapFile, setMapFile]     = useState<File | null>(null);
  const [mapPreview, setMapPreview] = useState<string | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Field helpers ───────────────────────────────────────────────────────────
  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  // ── Map file handling ───────────────────────────────────────────────────────
  const acceptFile = useCallback((file: File) => {
    const allowed = ['image/svg+xml', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setErrors((er) => ({ ...er }));
      setSubmitError('Map file must be SVG, PNG, or JPG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Map file must be ≤ 5 MB.');
      return;
    }
    setMapFile(file);
    setSubmitError(null);
    const reader = new FileReader();
    reader.onload = (e) => setMapPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) acceptFile(file);
    },
    [acceptFile],
  );

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())  e.name = 'Center name is required';
    if (!form.code.trim())  e.code = 'Branch code is required';
    else if (!CODE_RE.test(form.code.trim()))
      e.code = 'Must match format FAL-XXX-NNN (e.g. FAL-ABJ-002)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name',    form.name.trim());
      fd.append('code',    form.code.trim().toUpperCase());
      if (form.address) fd.append('address', form.address.trim());
      if (form.city)    fd.append('city',    form.city.trim());
      if (form.state)   fd.append('state',   form.state.trim());
      if (form.country) fd.append('country', form.country.trim());
      if (form.phone)   fd.append('phone',   form.phone.trim());
      if (mapFile)      fd.append('mapFile', mapFile);

      const { data } = await centersApi.create(fd);
      router.push(`/super-admin/centers/${data.id}?setup=true`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create center. Please try again.';
      setSubmitError(Array.isArray(msg) ? msg.join(' · ') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/super-admin/centers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Centers
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
          <Building2 className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Register New Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Add a new Falcon Security branch to the system
          </p>
        </div>
      </div>

      {/* Form card */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">

        {/* ── Section: Identity ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Center Identity</span>
          </div>

          <Field label="Center Name" required error={errors.name}>
            <Input
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Falcon Branch — Abuja"
              error={!!errors.name}
            />
          </Field>

          <Field
            label="Branch Code"
            required
            hint="Unique identifier. Format: FAL-XXX-NNN (e.g. FAL-ABJ-002)"
            error={errors.code}
          >
            <div className="relative">
              <Code2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <Input
                value={form.code}
                onChange={(e) => {
                  set('code')(e);
                  // Auto-uppercase
                  setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }));
                }}
                placeholder="FAL-ABJ-002"
                className={cn(
                  'h-10 pl-9 pr-3 w-full bg-slate-800 border rounded-lg text-sm text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors',
                  errors.code ? 'border-red-500/60' : 'border-slate-700',
                )}
                error={!!errors.code}
              />
            </div>
          </Field>
        </div>

        {/* ── Section: Location ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Location</span>
          </div>

          <Field label="Street Address">
            <Input value={form.address} onChange={set('address')} placeholder="14 Broad Street" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <Input value={form.city} onChange={set('city')} placeholder="Lagos Island" />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={set('state')} placeholder="Lagos" />
            </Field>
          </div>

          <Field label="Country">
            <Input value={form.country} onChange={set('country')} placeholder="Nigeria" />
          </Field>
        </div>

        {/* ── Section: Contact ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Contact</span>
          </div>

          <Field label="Phone Number">
            <Input value={form.phone} onChange={set('phone')} placeholder="+234-800-FALCON-1" type="tel" />
          </Field>
        </div>

        {/* ── Section: Floor Plan Map ── */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
            <ImageIcon className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Floor Plan / Site Map</span>
            <span className="ml-auto text-[10px] text-slate-600">Optional · SVG, PNG or JPG · Max 5 MB</span>
          </div>

          {mapPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapPreview}
                alt="Map preview"
                className="w-full max-h-64 object-contain"
              />
              <button
                type="button"
                onClick={() => { setMapFile(null); setMapPreview(null); }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-900/80 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 px-2 py-1 bg-slate-900/80 backdrop-blur-sm rounded-lg border border-slate-700">
                <Upload className="w-3 h-3 text-violet-400 shrink-0" />
                <span className="text-xs text-slate-300 truncate">{mapFile?.name}</span>
                <span className="text-[10px] text-slate-600 shrink-0 ml-auto">
                  {((mapFile?.size ?? 0) / 1024).toFixed(0)} KB
                </span>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-3 h-40 rounded-xl border-2 border-dashed cursor-pointer transition-all',
                dragOver
                  ? 'border-violet-500/60 bg-violet-500/5'
                  : 'border-slate-700 bg-slate-800/30 hover:border-slate-600 hover:bg-slate-800/50',
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Upload className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400">
                  <span className="text-violet-400 font-medium">Click to upload</span> or drag &amp; drop
                </p>
                <p className="text-xs text-slate-600 mt-0.5">SVG, PNG, JPG — up to 5 MB</p>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) acceptFile(file);
            }}
          />
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
            <X className="w-4 h-4 shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <Link
            href="/super-admin/centers"
            className="px-4 py-2 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-500/40 text-slate-900 font-semibold text-sm rounded-xl transition-all"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Register Center</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
