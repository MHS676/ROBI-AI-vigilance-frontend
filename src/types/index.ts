// ─── Local Media (on-disk recording index) ───────────────────────────────────

export type MediaType = 'VIDEO' | 'AUDIO' | 'WIFI_SENSING'

export interface LocalMedia {
  id: string
  mediaType: MediaType
  absolutePath: string
  fileSize: string          // BigInt serialised as string by JSON
  cameraNumber: number | null
  micNumber: number | null
  centerId: string
  tableId: string | null
  table?: Pick<Table, 'id' | 'name' | 'tableNumber'> | null
  center?: Pick<Center, 'id' | 'name' | 'code'> | null
  recordingDate: string     // "YYYY-MM-DD"
  durationSec: number | null
  notes: string | null
  createdAt: string
}

export interface LocalMediaPage {
  data: LocalMedia[]
  meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface LocalMediaStats {
  totalFiles: number
  totalBytes: bigint | number
  byType: Record<MediaType, { count: number; bytes: number }>
}

// ─── Role & Status Enums ──────────────────────────────────────────────────────
export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';

// ─── Enterprise Dashboard: Source Technology ─────────────────────────────────
/** Which physical sensor technology produces data for a given objective */
export type SourceTech = 'CCTV' | 'WIFI' | 'AUDIO' | 'CCTV+WIFI' | 'CCTV+AUDIO' | 'ALL';

/** Status of a single objective row in the Unified Status Matrix */
export type ObjectiveStatus = 'NORMAL' | 'WARNING' | 'ALERT' | 'INACTIVE';

/** Per-row hybrid mode: which source to prioritise */
export interface HybridSourceConfig {
  objectiveId: number;
  /** If true, prioritise WiFi/Audio over GPU-heavy CCTV model */
  preferLowCompute: boolean;
  /** Which source is currently active/primary */
  primarySource: SourceTech;
}

/** A single alert in the live ticker feed — includes source + confidence */
export interface ConfidencedAlert {
  id: string;
  objectiveId: number;
  objectiveLabel: string;
  /** Technology that triggered the alert */
  tech: SourceTech;
  /** Confidence score 0–100 */
  confidence: number;
  centerId: string;
  centerName: string;
  severity: AlertSeverity;
  serverTime: string;
  data: Record<string, unknown>;
}

/** One of the 20 Enterprise Objectives */
export interface EnterpriseObjective {
  id: number;
  label: string;
  description: string;
  sources: SourceTech;
  /** Which WS events trigger this objective */
  wsEvents: string[];
  /** Default severity when triggered */
  defaultSeverity: AlertSeverity;
  /** Whether GPU-heavy CCTV models are needed */
  highCompute: boolean;
}

/** Resource Saver Mode state for a center or globally */
export interface ResourceSaverState {
  /** Global override for all centers */
  globalEnabled: boolean;
  /** Per-center override — key is centerId */
  centerOverrides: Record<string, boolean>;
}

/** Device health entry used in the center health sidebar */
export interface CenterHealthEntry {
  centerId: string;
  centerName: string;
  camerasOnline: number;
  camerasTotal: number;
  wifiNodesOnline: number;
  wifiNodesTotal: number;
  /** Average mic level across all microphones 0–100 */
  avgMicLevel: number;
  lastActivity: string;
}
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
export type MicrophoneChannel = 'LEFT' | 'RIGHT';
export type AlertSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Alert type — mirrors AiFeature values plus sensor-derived event categories */
export type AlertType =
  | 'WEAPON'
  | 'FIGHT'
  | 'FALL'
  | 'FIRE'
  | 'CROWD'
  | 'HIGH_AUDIO'
  | 'WIFI_FALL'
  | 'DEVICE_OFFLINE';

// ─── Provisioning Enums ───────────────────────────────────────────────────────
export type InventoryStatus = 'PENDING' | 'ASSIGNED' | 'OFFLINE' | 'REJECTED';
export type InventoryDeviceType = 'ESP32' | 'AI_MICROPHONE' | 'CAMERA';

// ─── AI Feature Configuration ─────────────────────────────────────────────────
/** AI inference features that can be individually toggled per camera. */
export type AiFeature = 'WEAPON' | 'FIGHT' | 'FALL' | 'FIRE' | 'CROWD';

export const AI_FEATURE_META: Record<
  AiFeature,
  { label: string; description: string; icon: string; color: string }
> = {
  WEAPON: {
    label:       'Weapon Detection',
    description: 'Detects knives, guns, pistols, rifles and other weapons.',
    icon:        '🔫',
    color:       'red',
  },
  FIGHT: {
    label:       'Fight / Aggression',
    description: 'Detects physical altercations and aggressive behaviour.',
    icon:        '⚠️',
    color:       'orange',
  },
  FALL: {
    label:       'Fall Detection',
    description: 'Detects a person falling inside the camera zone.',
    icon:        '🚨',
    color:       'yellow',
  },
  FIRE: {
    label:       'Fire & Smoke',
    description: 'Detects fire or smoke in the camera frame.',
    icon:        '🔥',
    color:       'amber',
  },
  CROWD: {
    label:       'Crowd Detection',
    description: 'Alerts when over-crowding is detected in the zone.',
    icon:        '👥',
    color:       'blue',
  },
};

export const ALL_AI_FEATURES: AiFeature[] = ['WEAPON', 'FIGHT', 'FALL', 'FIRE', 'CROWD'];

// ─── Domain Models ────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  centerId: string | null;
  isActive: boolean;
}

export interface Center {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  isActive: boolean;
  mapUrl?: string | null;
  _count?: {
    cameras: number;
    espNodes: number;
    microphones: number;
    tables: number;
    users: number;
  };
}

export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  ipAddress: string;
  model: string;
  status: DeviceStatus;
  centerId: string;
  /** Enabled AI inference features — defaults to all five if not set */
  aiFeatures: AiFeature[];
}

export interface EspNode {
  id: string;
  name: string;
  macAddress: string;
  ipAddress: string;
  firmwareVer: string;
  status: DeviceStatus;
  lastSeenAt: string;
  centerId: string;
}

export interface Microphone {
  id: string;
  name: string;
  channel: MicrophoneChannel;
  ipAddress: string;
  model: string;
  status: DeviceStatus;
  centerId: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Table {
  id: string;
  name: string;
  tableNumber: number;
  centerId: string;
  cameraId: string | null;
  boundingBox: BoundingBox | null;
  microphoneId: string | null;
  agentId: string | null;
  isActive: boolean;
  // ── Spatial Gating (5-foot WiFi / Audio zone) ──────────────
  /** Top-left X of the WiFi gate zone in floor-plan pixels */
  wifiZoneX: number | null;
  /** Top-left Y of the WiFi gate zone in floor-plan pixels */
  wifiZoneY: number | null;
  /** Width of the WiFi gate zone in floor-plan pixels */
  wifiZoneWidth: number | null;
  /** Height of the WiFi gate zone in floor-plan pixels */
  wifiZoneHeight: number | null;
  /** Per-table audio alert threshold in dB (overrides system default when set) */
  audioThresholdDb: number | null;
}

/** Persisted AI / sensor alert record — mirrors the DB Alert model */
export interface Alert {
  id: string;
  /** Alert category — e.g. "WEAPON", "FALL", "HIGH_AUDIO" */
  type: AlertType;
  /** Severity level */
  severity: AlertSeverity;
  /** Model / sensor confidence score (0.0 – 1.0) */
  confidence: number;
  /** S3 presigned URL of the JPEG evidence frame (null when not captured) */
  imageUrl: string | null;
  timestamp: string;
  centerId: string;
  center?: Pick<Center, 'id' | 'name' | 'code'>;
  tableId: string | null;
  table?: Pick<Table, 'id' | 'name' | 'tableNumber'> | null;
  cameraId: string | null;
  camera?: Pick<Camera, 'id' | 'name'> | null;
}

export interface HardwareInventory {
  cameras: (Camera & { assignedTableId?: string | null; assignedTableName?: string | null })[];
  espNodes: (EspNode & { assignedTableId?: string | null })[];
  microphones: (Microphone & { assignedTableId?: string | null; assignedTableName?: string | null })[];
}

// ─── Device Inventory (Zero-Config Provisioning) ─────────────────────────────

export interface DeviceInventory {
  id: string;
  deviceType: InventoryDeviceType;
  macAddress: string | null;
  ipAddress: string | null;
  firmwareVer: string | null;
  model: string | null;
  hostname: string | null;
  manufacturer: string | null;
  onvifXAddr: string | null;
  rtspUrl: string | null;
  status: InventoryStatus;
  centerId: string | null;
  center?: { id: string; name: string; code: string } | null;
  discoveryPayload: Record<string, unknown> | null;
  provisionConfig: Record<string, unknown> | null;
  lastSeenAt: string | null;
  provisionedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryStats {
  total: number;
  pending: number;
  assigned: number;
  rejected: number;
  offline: number;
}

/** Camera returned from ONVIF/TCP scan (not yet saved to DB) */
export interface DiscoveredCamera {
  ipAddress: string;
  manufacturer?: string;
  model?: string;
  onvifXAddr?: string;
  rtspUrl?: string;
  ports: number[];
  discoveryMethod: 'onvif' | 'tcp-scan' | 'both';
}

// ─── Provisioning DTOs ────────────────────────────────────────────────────────

export interface AssignDeviceDto {
  centerId: string;
  tableId?: string;
  wifiSsid: string;
  wifiPassword: string;
  notes?: string;
}

export interface RejectDeviceDto {
  notes?: string;
}

export interface ScanCamerasDto {
  subnet: string;
  timeoutMs?: number;
  concurrency?: number;
}

export interface AddDiscoveredCameraDto {
  centerId: string;
  ipAddress: string;
  manufacturer?: string;
  model?: string;
  onvifXAddr?: string;
  rtspUrl?: string;
  name?: string;
}

// ─── Auth DTOs ────────────────────────────────────────────────────────────────
export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user: User;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  centerId: string | null;
  iat: number;
  exp: number;
}

// ─── API error shape ──────────────────────────────────────────────────────────
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
}

// ─── WebSocket event envelope ─────────────────────────────────────────────────
export interface WsEventEnvelope<T = unknown> {
  serverTime: string;
  severity: AlertSeverity;
  centerId: string;
  centerName: string;
  data: T;
}

// ─── Real-time AI / WiFi / Audio payloads (from update:* WS events) ──────────

/** Payload for `update:ai_results` */
export interface AiResultPayload {
  tableId: string;
  tableName?: string;
  tableNumber?: number;
  /** Whether the assigned agent is at the table */
  agentPresent: boolean;
  /** Count of customers detected by the vision model */
  customerCount: number;
  isFallDetected: boolean;
  isAggressionDetected: boolean;
  /** Model confidence 0–1 */
  confidence: number;
  /** Pixel bounding box in the original camera frame */
  boundingBoxPx?: { x: number; y: number; width: number; height: number };
}

/** Payload for `update:wifi_sensing` */
export interface WifiSensingPayload {
  tableId: string;
  tableName?: string;
  tableNumber?: number;
  customerPresent: boolean;
  estimatedCount: number;
  /** Average distance from ESP node in centimetres */
  averageDistance: number;
  /** Seconds the current customer has been waiting (backend-tracked) */
  waitTimeSeconds?: number;
}

/** Payload for `update:audio_level` */
export interface AudioLevelPayload {
  tableId: string;
  tableName?: string;
  /** Instantaneous decibel reading */
  decibels: number;
  isAlert: boolean;
}

/**
 * Merged, per-table real-time state.
 * Populated by combining ai_results + wifi_sensing + audio_level events.
 */
export interface TableStatus {
  tableId: string;
  tableName: string;
  tableNumber: number;
  centerId: string;
  // ── AI fields ─────────────────────────────────────────────────────────────
  agentPresent: boolean;
  customerCount: number;
  isFallDetected: boolean;
  isAggressionDetected: boolean;
  aiConfidence: number;
  /** Pixel bounding box if available — used for video overlay */
  boundingBoxPx?: { x: number; y: number; width: number; height: number };
  // ── WiFi fields ───────────────────────────────────────────────────────────
  wifiCustomerPresent: boolean;
  wifiEstimatedCount: number;
  waitTimeSeconds: number;
  // ── Audio fields ──────────────────────────────────────────────────────────
  audioDecibels: number;
  isAudioAlert: boolean;
  // ── Meta ──────────────────────────────────────────────────────────────────
  lastUpdated: string;
}
