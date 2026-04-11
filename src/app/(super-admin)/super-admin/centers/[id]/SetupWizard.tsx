'use client';

import { useState, useCallback } from 'react';
import {
  Camera, Mic, Cpu, CheckCircle2, XCircle, Loader2, Wifi, WifiOff,
  ArrowRight, ArrowLeft, Plus, Minus, Sparkles,
} from 'lucide-react';
import { camerasApi, microphonesApi, espNodesApi } from '@/lib/api';
import type { Camera as CameraType, Microphone, EspNode } from '@/types';
import { cn } from '@/lib/utils';

interface CameraEntry { name: string; rtspUrl: string; ipAddress: string; model: string; }
interface MicEntry    { name: string; channel: 'LEFT' | 'RIGHT'; ipAddress: string; model: string; }
interface EspEntry    { name: string; macAddress: string; ipAddress: string; firmwareVer: string; }

interface Result<T> {
  entry: T;
  device?: CameraType | Microphone | EspNode;
  error?: string;
  pingStatus?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  latencyMs?: number | null;
  pinging: boolean;
}

type Step = 'counts' | 'cameras' | 'mics' | 'esps' | 'registering' | 'done';

interface SetupWizardProps {
  centerId:   string;
  centerName: string;
  onComplete: () => void;
  onSkip:     () => void;
}

const EMPTY_CAM: CameraEntry = { name: '', rtspUrl: '', ipAddress: '', model: '' };
const EMPTY_MIC: MicEntry    = { name: '', channel: 'LEFT', ipAddress: '', model: '' };
const EMPTY_ESP: EspEntry    = { name: '', macAddress: '', ipAddress: '', firmwareVer: '' };

const STEPS: { key: Step; label: string }[] = [
  { key: 'counts',      label: 'Counts'   },
  { key: 'cameras',     label: 'Cameras'  },
  { key: 'mics',        label: 'Mics'     },
  { key: 'esps',        label: 'ESP'      },
  { key: 'registering', label: 'Register' },
  { key: 'done',        label: 'Done'     },
];

function NavButtons({
  onNext, onBack, onSkip, nextLabel = 'Continue', nextDisabled = false,
}: {
  onNext?: () => void; onBack?: () => void; onSkip?: () => void;
  nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-1 flex-wrap">
      {onNext && (
        <button type="button" onClick={onNext} disabled={nextDisabled}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-semibold text-sm rounded-xl transition">
          {nextLabel} <ArrowRight className="w-4 h-4" />
        </button>
      )}
      {onBack && (
        <button type="button" onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-xl transition">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      )}
      {onSkip && (
        <button type="button" onClick={onSkip}
          className="ml-auto px-4 py-2 text-xs text-slate-600 hover:text-slate-400 transition">
          Skip for now
        </button>
      )}
    </div>
  );
}

function CountRow({ icon, label, count, onChange, min = 0 }: {
  icon: React.ReactNode; label: string; count: number;
  onChange: (n: number) => void; min?: number;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 w-40 shrink-0">
        {icon}
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, count - 1))} disabled={count <= min}
          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-40 transition">
          <Minus className="w-3.5 h-3.5" />
        </button>
        <input type="number" value={count} min={min} max={20}
          onChange={(e) => onChange(Math.max(min, Math.min(20, parseInt(e.target.value, 10) || 0)))}
          className="w-16 h-8 text-center bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-cyan-500" />
        <button type="button" onClick={() => onChange(Math.min(20, count + 1))} disabled={count >= 20}
          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-40 transition">
          <Plus className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs text-slate-500 ml-1">
          {count === 0 ? 'none' : count === 1 ? '1 device' : `${count} devices`}
        </span>
      </div>
    </div>
  );
}

function ResultRow({ label, icon, error, pinging, pingStatus, latencyMs, registered }: {
  label: string; icon: React.ReactNode; error?: string; pinging: boolean;
  pingStatus?: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; latencyMs?: number | null; registered: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-800/50 border border-slate-700/40">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon}
        <span className="text-sm text-slate-200 truncate">{label}</span>
      </div>
      <div className="shrink-0 ml-3">
        {error ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-400"><XCircle className="w-3.5 h-3.5" /> Failed</span>
        ) : pinging ? (
          <span className="inline-flex items-center gap-1 text-xs text-amber-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Pinging…</span>
        ) : pingStatus === 'ONLINE' ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Wifi className="w-3.5 h-3.5" /> Online
            {latencyMs != null && <span className="px-1 py-0.5 rounded bg-emerald-900/60 text-[10px]">{latencyMs}ms</span>}
          </span>
        ) : pingStatus === 'OFFLINE' ? (
          <span className="inline-flex items-center gap-1 text-xs text-red-400"><WifiOff className="w-3.5 h-3.5" /> Unreachable</span>
        ) : registered ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Registered</span>
        ) : (
          <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
        )}
      </div>
    </div>
  );
}

function AllResults({ camResults, micResults, espResults }: {
  camResults: Result<CameraEntry>[];
  micResults: Result<MicEntry>[];
  espResults: Result<EspEntry>[];
}) {
  return (
    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
      {camResults.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Camera className="w-3 h-3" /> Cameras
          </p>
          {camResults.map((r, i) => (
            <ResultRow key={i} label={r.entry.name || `Camera ${i + 1}`}
              icon={<Camera className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              error={r.error} pinging={r.pinging} pingStatus={r.pingStatus} latencyMs={r.latencyMs} registered={!!r.device} />
          ))}
        </div>
      )}
      {micResults.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Mic className="w-3 h-3" /> Microphones
          </p>
          {micResults.map((r, i) => (
            <ResultRow key={i} label={`${r.entry.name || `Mic ${i + 1}`} (${r.entry.channel})`}
              icon={<Mic className="w-3.5 h-3.5 text-pink-400 shrink-0" />}
              error={r.error} pinging={r.pinging} pingStatus={r.pingStatus} latencyMs={r.latencyMs} registered={!!r.device} />
          ))}
        </div>
      )}
      {espResults.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Cpu className="w-3 h-3" /> ESP Nodes
          </p>
          {espResults.map((r, i) => (
            <ResultRow key={i} label={r.entry.name || `ESP ${i + 1}`}
              icon={<Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              error={r.error} pinging={r.pinging} pingStatus={r.pingStatus} latencyMs={r.latencyMs} registered={!!r.device} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SetupWizard({ centerId, centerName, onComplete, onSkip }: SetupWizardProps) {
  const [camCount, setCamCount] = useState(1);
  const [micCount, setMicCount] = useState(0);
  const [espCount, setEspCount] = useState(0);
  const [cameras, setCameras]   = useState<CameraEntry[]>([{ ...EMPTY_CAM }]);
  const [mics,    setMics]      = useState<MicEntry[]>([]);
  const [esps,    setEsps]      = useState<EspEntry[]>([]);
  const [camResults, setCamResults] = useState<Result<CameraEntry>[]>([]);
  const [micResults, setMicResults] = useState<Result<MicEntry>[]>([]);
  const [espResults, setEspResults] = useState<Result<EspEntry>[]>([]);
  const [step,        setStep]       = useState<Step>('counts');
  const [formErrors,  setFormErrors] = useState<Record<number, string>>({});
  const [registering, setRegistering] = useState(false);

  const handleCamCount = useCallback((n: number) => {
    setCamCount(n);
    setCameras((prev) => n > prev.length
      ? [...prev, ...Array.from({ length: n - prev.length }, () => ({ ...EMPTY_CAM }))]
      : prev.slice(0, n));
  }, []);

  const handleMicCount = useCallback((n: number) => {
    setMicCount(n);
    setMics((prev) => n > prev.length
      ? [...prev, ...Array.from({ length: n - prev.length }, () => ({ ...EMPTY_MIC }))]
      : prev.slice(0, n));
  }, []);

  const handleEspCount = useCallback((n: number) => {
    setEspCount(n);
    setEsps((prev) => n > prev.length
      ? [...prev, ...Array.from({ length: n - prev.length }, () => ({ ...EMPTY_ESP }))]
      : prev.slice(0, n));
  }, []);

  const updateCam = useCallback((i: number, k: keyof CameraEntry, v: string) => {
    setCameras((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
    setFormErrors((e) => { const n = { ...e }; delete n[i]; return n; });
  }, []);

  const updateMic = useCallback((i: number, k: keyof MicEntry, v: string) => {
    setMics((p) => p.map((m, idx) => (idx === i ? { ...m, [k]: v } : m)));
    setFormErrors((e) => { const n = { ...e }; delete n[i]; return n; });
  }, []);

  const updateEsp = useCallback((i: number, k: keyof EspEntry, v: string) => {
    setEsps((p) => p.map((e, idx) => (idx === i ? { ...e, [k]: v } : e)));
    setFormErrors((e) => { const n = { ...e }; delete n[i]; return n; });
  }, []);

  const validateCameras = useCallback((): boolean => {
    const errs: Record<number, string> = {};
    cameras.forEach((c, i) => {
      if (!c.name.trim())           errs[i] = 'Name required';
      else if (!c.ipAddress.trim()) errs[i] = 'IP required';
      else if (!c.rtspUrl.trim())   errs[i] = 'RTSP URL required';
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [cameras]);

  const validateMics = useCallback((): boolean => {
    const errs: Record<number, string> = {};
    mics.forEach((m, i) => { if (!m.name.trim()) errs[i] = 'Name required'; });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [mics]);

  const validateEsps = useCallback((): boolean => {
    const MAC_RE = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;
    const errs: Record<number, string> = {};
    esps.forEach((e, i) => {
      if (!e.name.trim())                  errs[i] = 'Name required';
      else if (!e.macAddress.trim())       errs[i] = 'MAC address required';
      else if (!MAC_RE.test(e.macAddress)) errs[i] = 'Invalid MAC (AA:BB:CC:DD:EE:FF)';
    });
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }, [esps]);

  const registerAll = useCallback(async () => {
    setRegistering(true);
    setStep('registering');
    setCamResults(cameras.map((e) => ({ entry: e, pinging: false })));
    setMicResults(mics.map((e)    => ({ entry: e, pinging: false })));
    setEspResults(esps.map((e)    => ({ entry: e, pinging: false })));

    const [camReg, micReg, espReg] = await Promise.all([
      Promise.all(cameras.map(async (entry) => {
        try {
          const res = await camerasApi.create({
            name: entry.name.trim(), rtspUrl: entry.rtspUrl.trim(),
            ipAddress: entry.ipAddress.trim() || undefined,
            model: entry.model.trim() || undefined, centerId,
          });
          return { entry, device: res.data as CameraType };
        } catch (err: unknown) {
          const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          return { entry, error: Array.isArray(raw) ? raw.join(', ') : String(raw ?? 'Failed') };
        }
      })),
      Promise.all(mics.map(async (entry) => {
        try {
          const res = await microphonesApi.create({
            name: entry.name.trim(), channel: entry.channel,
            ipAddress: entry.ipAddress.trim() || undefined,
            model: entry.model.trim() || undefined, centerId,
          });
          return { entry, device: res.data as Microphone };
        } catch (err: unknown) {
          const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          return { entry, error: Array.isArray(raw) ? raw.join(', ') : String(raw ?? 'Failed') };
        }
      })),
      Promise.all(esps.map(async (entry) => {
        try {
          const res = await espNodesApi.create({
            name: entry.name.trim(), macAddress: entry.macAddress.trim(),
            ipAddress: entry.ipAddress.trim() || undefined,
            firmwareVer: entry.firmwareVer.trim() || undefined, centerId,
          });
          return { entry, device: res.data as EspNode };
        } catch (err: unknown) {
          const raw = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
          return { entry, error: Array.isArray(raw) ? raw.join(', ') : String(raw ?? 'Failed') };
        }
      })),
    ]);

    setRegistering(false);
    setCamResults(camReg.map((r) => ({
      entry: r.entry,
      device: 'device' in r ? r.device : undefined,
      error:  'error'  in r ? r.error  : undefined,
      pinging: 'device' in r && !!(r.device as CameraType).ipAddress,
    })));
    setMicResults(micReg.map((r) => ({
      entry: r.entry,
      device: 'device' in r ? r.device : undefined,
      error:  'error'  in r ? r.error  : undefined,
      pinging: 'device' in r && !!(r.device as Microphone).ipAddress,
    })));
    setEspResults(espReg.map((r) => ({
      entry: r.entry,
      device: 'device' in r ? r.device : undefined,
      error:  'error'  in r ? r.error  : undefined,
      pinging: 'device' in r && !!(r.device as EspNode).ipAddress,
    })));

    const [camPings, micPings, espPings] = await Promise.all([
      Promise.all(
        camReg
          .filter((r): r is { entry: CameraEntry; device: CameraType } =>
            'device' in r && !!(r.device as CameraType).ipAddress)
          .map(async ({ device }) => {
            try {
              const r = await camerasApi.ping(device.id);
              return { id: device.id, status: r.data.status, latencyMs: r.data.latencyMs };
            } catch {
              return { id: device.id, status: 'OFFLINE', latencyMs: null };
            }
          }),
      ),
      Promise.all(
        micReg
          .filter((r): r is { entry: MicEntry; device: Microphone } =>
            'device' in r && !!(r.device as Microphone).ipAddress)
          .map(async ({ device }) => {
            try {
              const r = await microphonesApi.ping(device.id);
              return { id: device.id, status: r.data.status, latencyMs: r.data.latencyMs };
            } catch {
              return { id: device.id, status: 'OFFLINE', latencyMs: null };
            }
          }),
      ),
      Promise.all(
        espReg
          .filter((r): r is { entry: EspEntry; device: EspNode } =>
            'device' in r && !!(r.device as EspNode).ipAddress)
          .map(async ({ device }) => {
            try {
              const r = await espNodesApi.ping(device.id);
              return { id: device.id, status: r.data.status, latencyMs: r.data.latencyMs };
            } catch {
              return { id: device.id, status: 'OFFLINE', latencyMs: null };
            }
          }),
      ),
    ]);

    const applyPings = <T,>(
      prev: Result<T>[],
      pings: { id: string; status: string; latencyMs: number | null }[],
    ): Result<T>[] =>
      prev.map((r) => {
        if (!r.device) return r;
        const ping = pings.find((p) => p.id === (r.device as { id: string }).id);
        return {
          ...r,
          pinging: false,
          pingStatus: (ping?.status ?? 'UNKNOWN') as 'ONLINE' | 'OFFLINE' | 'UNKNOWN',
          latencyMs: ping?.latencyMs ?? null,
        };
      });

    setCamResults((prev) => applyPings(prev, camPings));
    setMicResults((prev) => applyPings(prev, micPings));
    setEspResults((prev) => applyPings(prev, espPings));
    setStep('done');
  }, [cameras, mics, esps, centerId]);

  const handleCountsContinue = () => {
    setFormErrors({});
    if (camCount > 0) { setStep('cameras'); return; }
    if (micCount > 0) { setStep('mics');    return; }
    if (espCount > 0) { setStep('esps');    return; }
    void registerAll();
  };

  const goFromCameras = () => {
    if (!validateCameras()) return;
    setFormErrors({});
    if (micCount > 0) { setStep('mics'); return; }
    if (espCount > 0) { setStep('esps'); return; }
    void registerAll();
  };

  const goFromMics = () => {
    if (!validateMics()) return;
    setFormErrors({});
    if (espCount > 0) { setStep('esps'); return; }
    void registerAll();
  };

  const goFromEsps = () => {
    if (!validateEsps()) return;
    setFormErrors({});
    void registerAll();
  };

  const stepIndex  = STEPS.findIndex((s) => s.key === step);
  const allResults = [...camResults, ...micResults, ...espResults];
  const totalItems  = allResults.length;
  const totalReg    = allResults.filter((r) => r.device).length;
  const totalOnline = allResults.filter((r) => r.pingStatus === 'ONLINE').length;
  const totalFailed = allResults.filter((r) => r.error).length;
  const totalDevs   = camCount + micCount + espCount;

  return (
    <div className="bg-slate-900 border border-cyan-500/25 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 bg-gradient-to-r from-cyan-500/10 via-indigo-500/5 to-transparent border-b border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-none">Device Setup Wizard</p>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              Register &amp; verify all devices for{' '}
              <span className="text-slate-200">{centerName}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s.key} title={s.label}
              className={cn(
                'rounded-full transition-all',
                stepIndex === i ? 'w-4 h-2 bg-cyan-400' :
                stepIndex  > i ? 'w-2 h-2 bg-cyan-600' : 'w-2 h-2 bg-slate-700',
              )} />
          ))}
        </div>
      </div>

      <div className="p-5">
        {/* ── Step: counts ── */}
        {step === 'counts' && (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-base font-semibold text-white mb-1">How many devices will this center have?</h3>
              <p className="text-sm text-slate-400">Set the count for each device type. You can add more at any time.</p>
            </div>
            <div className="flex flex-col gap-4 p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
              <CountRow icon={<Camera className="w-4 h-4 text-indigo-400" />} label="Cameras"     count={camCount} onChange={handleCamCount} min={1} />
              <CountRow icon={<Mic    className="w-4 h-4 text-pink-400"  />} label="Microphones" count={micCount} onChange={handleMicCount} min={0} />
              <CountRow icon={<Cpu    className="w-4 h-4 text-amber-400" />} label="ESP Nodes"   count={espCount} onChange={handleEspCount} min={0} />
            </div>
            <NavButtons onNext={handleCountsContinue} onSkip={onSkip} nextLabel="Continue" />
          </div>
        )}

        {/* ── Step: cameras ── */}
        {step === 'cameras' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Camera className="w-4 h-4 text-indigo-400" /> Camera details ({camCount})
            </h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {cameras.map((cam, i) => (
                <div key={i} className={cn('p-3 rounded-xl border',
                  formErrors[i] ? 'border-red-500/40 bg-red-950/20' : 'border-slate-700/50 bg-slate-800/30')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[9px] font-bold text-indigo-400">{i + 1}</span>
                    {formErrors[i] && <p className="text-xs text-red-400">{formErrors[i]}</p>}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {([
                      { f: 'name'      as const, label: 'Camera Name', ph: `Camera ${i + 1}`,                    mono: false, req: true  },
                      { f: 'ipAddress' as const, label: 'IP Address',  ph: '192.168.1.100',                       mono: true,  req: true  },
                      { f: 'rtspUrl'   as const, label: 'RTSP URL',    ph: 'rtsp://user:pass@192.168.1.100:554',  mono: true,  req: true  },
                      { f: 'model'     as const, label: 'Model',       ph: 'Hikvision DS-2CD…',               mono: false, req: false },
                    ] as const).map(({ f, label, ph, mono, req }) => (
                      <div key={f}>
                        <label className="block text-[10px] text-slate-500 mb-1">
                          {label}{req && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        <input value={cam[f]} onChange={(e) => updateCam(i, f, e.target.value)} placeholder={ph}
                          className={cn('w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition', mono && 'font-mono')} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <NavButtons
              onNext={goFromCameras} onBack={() => setStep('counts')} onSkip={onSkip}
              nextLabel={micCount > 0 ? 'Next: Microphones' : espCount > 0 ? 'Next: ESP Nodes' : `Register ${totalDevs} Device${totalDevs !== 1 ? 's' : ''}`}
            />
          </div>
        )}

        {/* ── Step: mics ── */}
        {step === 'mics' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-pink-400" /> Microphone details ({micCount})
            </h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {mics.map((mic, i) => (
                <div key={i} className={cn('p-3 rounded-xl border',
                  formErrors[i] ? 'border-red-500/40 bg-red-950/20' : 'border-slate-700/50 bg-slate-800/30')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-[9px] font-bold text-pink-400">{i + 1}</span>
                    {formErrors[i] && <p className="text-xs text-red-400">{formErrors[i]}</p>}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Mic Name <span className="text-red-400">*</span></label>
                      <input value={mic.name} onChange={(e) => updateMic(i, 'name', e.target.value)} placeholder={`Microphone ${i + 1}`}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Channel <span className="text-red-400">*</span></label>
                      <select value={mic.channel} onChange={(e) => updateMic(i, 'channel', e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500">
                        <option value="LEFT">LEFT</option>
                        <option value="RIGHT">RIGHT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">IP Address</label>
                      <input value={mic.ipAddress} onChange={(e) => updateMic(i, 'ipAddress', e.target.value)} placeholder="192.168.1.150"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500" />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Model</label>
                      <input value={mic.model} onChange={(e) => updateMic(i, 'model', e.target.value)} placeholder="Rode NT-USB Mini"
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <NavButtons
              onNext={goFromMics}
              onBack={() => camCount > 0 ? setStep('cameras') : setStep('counts')}
              onSkip={onSkip}
              nextLabel={espCount > 0 ? 'Next: ESP Nodes' : `Register ${totalDevs} Device${totalDevs !== 1 ? 's' : ''}`}
            />
          </div>
        )}

        {/* ── Step: esps ── */}
        {step === 'esps' && (
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" /> ESP Node details ({espCount})
            </h3>
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {esps.map((esp, i) => (
                <div key={i} className={cn('p-3 rounded-xl border',
                  formErrors[i] ? 'border-red-500/40 bg-red-950/20' : 'border-slate-700/50 bg-slate-800/30')}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-[9px] font-bold text-amber-400">{i + 1}</span>
                    {formErrors[i] && <p className="text-xs text-red-400">{formErrors[i]}</p>}
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {([
                      { f: 'name'        as const, label: 'Node Name',    ph: `ESP-NODE-${i + 1}`,  mono: false, req: true  },
                      { f: 'macAddress'  as const, label: 'MAC Address',  ph: 'AA:BB:CC:DD:EE:FF',  mono: true,  req: true  },
                      { f: 'ipAddress'   as const, label: 'IP Address',   ph: '192.168.1.200',       mono: true,  req: false },
                      { f: 'firmwareVer' as const, label: 'Firmware Ver', ph: 'v2.1.4',              mono: true,  req: false },
                    ] as const).map(({ f, label, ph, mono, req }) => (
                      <div key={f}>
                        <label className="block text-[10px] text-slate-500 mb-1">
                          {label}{req && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        <input value={esp[f]} onChange={(e) => updateEsp(i, f, e.target.value)} placeholder={ph}
                          className={cn('w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition', mono && 'font-mono')} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <NavButtons
              onNext={goFromEsps}
              onBack={() => micCount > 0 ? setStep('mics') : camCount > 0 ? setStep('cameras') : setStep('counts')}
              onSkip={onSkip}
              nextLabel={`Register ${totalDevs} Device${totalDevs !== 1 ? 's' : ''}`}
            />
          </div>
        )}

        {/* ── Step: registering ── */}
        {step === 'registering' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
              <h3 className="text-base font-semibold text-white">
                {registering ? 'Registering devices…' : 'Verifying connectivity…'}
              </h3>
            </div>
            <AllResults camResults={camResults} micResults={micResults} espResults={espResults} />
          </div>
        )}

        {/* ── Step: done ── */}
        {step === 'done' && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                totalFailed === 0
                  ? 'bg-emerald-500/15 border border-emerald-500/30'
                  : 'bg-amber-500/15 border border-amber-500/30',
              )}>
                <CheckCircle2 className={cn('w-5 h-5', totalFailed === 0 ? 'text-emerald-400' : 'text-amber-400')} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{totalReg} / {totalItems} devices registered</h3>
                <p className="text-sm text-slate-400 mt-0.5">
                  <span className="text-emerald-400">{totalOnline} online</span>
                  {' · '}
                  <span className="text-red-400">{allResults.filter((r) => r.pingStatus === 'OFFLINE').length} offline</span>
                  {totalFailed > 0 && (
                    <>{' · '}<span className="text-red-400">{totalFailed} failed</span></>
                  )}
                </p>
              </div>
            </div>
            <AllResults camResults={camResults} micResults={micResults} espResults={espResults} />
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={onComplete}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm rounded-xl transition">
                <CheckCircle2 className="w-4 h-4" />
                Setup Complete — Go to Device Manager
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
