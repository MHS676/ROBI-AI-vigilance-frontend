'use client';

/**
 * alerts.store.ts — Zustand store for real-time event state.
 *
 * Holds two pieces of state:
 *  1. `alerts`       — ordered list of the last 200 alert/update events received
 *                      via the WebSocket (alert:fall_detected, etc.)
 *  2. `centerStatus` — a Map<centerId, CenterStatusEntry> updated whenever an
 *                      `update:device_status` event arrives, used by the
 *                      CenterStatusGrid to show per-center online/offline dots.
 *
 * This store is intentionally NOT persisted — it is ephemeral session data.
 */

import { create } from 'zustand';
import type {
  AlertSeverity,
  WsEventEnvelope,
  TableStatus,
  AiResultPayload,
  WifiSensingPayload,
  AudioLevelPayload,
  ConfidencedAlert,
  ObjectiveStatus,
  HybridSourceConfig,
} from '@/types';

// ─── WS event name constants (mirrors backend mqtt.constants.ts) ──────────────
export const ALERT_EVENTS = [
  'alert:fall_detected',
  'alert:aggression_detected',
  'alert:high_audio_level',
  'alert:crowd_detected',
  'alert:device_offline',
  'alert:weapon_detected',
  'alert:fire_detected',
  'alert:sick_detected',
  'alert:idle_agent',
  'alert:long_service',
  'alert:long_stay',
  'alert:vandalism_detected',
  'alert:irate_customer',
  'alert:challenged_visitor',
  'alert:ghost_token',
  'alert:repeated_visit',
] as const;

export const UPDATE_EVENTS = [
  'update:wifi_sensing',
  'update:ai_results',
  'update:audio_level',
  'update:device_status',
  'update:objective_status',
  'update:resource_saver',
  'update:hybrid_source',
] as const;

export type AlertEvent  = (typeof ALERT_EVENTS)[number];
export type UpdateEvent = (typeof UPDATE_EVENTS)[number];
export type WsEvent     = AlertEvent | UpdateEvent;

// ─── Display metadata ─────────────────────────────────────────────────────────
export const EVENT_META: Record<
  string,
  { label: string; emoji: string; isAlert: boolean }
> = {
  'alert:fall_detected':       { label: 'Fall Detected',        emoji: '🚨', isAlert: true  },
  'alert:aggression_detected': { label: 'Aggression',           emoji: '⚠️', isAlert: true  },
  'alert:high_audio_level':    { label: 'High Audio Level',     emoji: '🔊', isAlert: true  },
  'alert:crowd_detected':      { label: 'Crowd Detected',       emoji: '👥', isAlert: true  },
  'alert:device_offline':      { label: 'Device Offline',       emoji: '🔴', isAlert: true  },
  'alert:weapon_detected':     { label: 'Weapon Detected',      emoji: '🔫', isAlert: true  },
  'alert:fire_detected':       { label: 'Fire / Smoke',         emoji: '🔥', isAlert: true  },
  'alert:sick_detected':       { label: 'Sudden Sick',          emoji: '🏥', isAlert: true  },
  'alert:idle_agent':          { label: 'Idle Agent / Counter', emoji: '💤', isAlert: true  },
  'alert:long_service':        { label: 'Long Serving Time',    emoji: '⏱️', isAlert: true  },
  'alert:long_stay':           { label: 'Long Stay Detected',   emoji: '🕐', isAlert: true  },
  'alert:vandalism_detected':  { label: 'Vandalism / Shouting', emoji: '🗣️', isAlert: true  },
  'alert:irate_customer':      { label: 'Irate Customer',       emoji: '😠', isAlert: true  },
  'alert:challenged_visitor':  { label: 'Challenged Visitor',   emoji: '♿', isAlert: false },
  'alert:ghost_token':         { label: 'Ghost Token',          emoji: '👻', isAlert: true  },
  'alert:repeated_visit':      { label: 'Repeated Visit',       emoji: '🔁', isAlert: false },
  'update:wifi_sensing':       { label: 'WiFi Sensing',         emoji: '📡', isAlert: false },
  'update:ai_results':         { label: 'AI Detection',         emoji: '🤖', isAlert: false },
  'update:audio_level':        { label: 'Audio Level',          emoji: '🎙️', isAlert: false },
  'update:device_status':      { label: 'Device Status',        emoji: '📶', isAlert: false },
};

// ─── Shapes ───────────────────────────────────────────────────────────────────
export interface AlertItem {
  /** Unique ID for React list keys */
  id: string;
  /** Backend WS_EVENTS key, e.g. 'alert:fall_detected' */
  event: string;
  centerId: string;
  centerName: string;
  severity: AlertSeverity;
  /** ISO-8601 timestamp from the backend envelope */
  serverTime: string;
  /** Raw data payload — shape varies per event */
  data: Record<string, unknown>;
}

/** Tracks the latest device activity per center (derived from update:device_status events) */
export interface CenterStatusEntry {
  centerId: string;
  centerName: string;
  /** Device status from the MQTT payload */
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE';
  /** Which device type triggered this update */
  deviceType?: string;
  /** ISO timestamp of last update */
  lastSeen: string;
}
/** Represents a device that went offline (shown as red alert banner) */
export interface OfflineDeviceAlert {
  /** Unique key for deduplication: centerId+deviceId */
  key: string;
  deviceId: string;
  deviceType: string;
  deviceName?: string;
  ipAddress?: string;
  centerId: string;
  centerName: string;
  offlineSince: string;
  dismissed: boolean;
}
// ─── Store shape ──────────────────────────────────────────────────────────────
interface AlertsState {
  /** Live alert feed — newest first, capped at MAX_ALERTS */
  alerts: AlertItem[];
  /** Per-center latest device status */
  centerStatus: Record<string, CenterStatusEntry>;
  /** Active offline device alerts (shown as red banners on dashboard) */
  offlineDevices: OfflineDeviceAlert[];
  /** Unread alert count (reset by markRead) */
  unreadCount: number;
  /**
   * Per-table merged real-time state.
   * Keyed by tableId. Updated by update:ai_results, update:wifi_sensing,
   * and update:audio_level WebSocket events.
   */
  tableStatuses: Record<string, TableStatus>;

  // ── Enterprise Dashboard ──────────────────────────────────────────────────
  /**
   * Enhanced alert feed with confidence scores + source tech.
   * Cap at 100 entries. Newest first.
   */
  confidencedAlerts: ConfidencedAlert[];
  /** Per-objective live status — keyed by objectiveId */
  objectiveStatuses: Record<number, { status: ObjectiveStatus; confidence: number; lastTech: string; lastSeen: string }>;
  /** Hybrid source config — keyed by objectiveId */
  hybridSources: Record<number, HybridSourceConfig>;
  /** Resource Saver Mode: global + per-center */
  resourceSaverGlobal: boolean;
  resourceSaverCenters: Record<string, boolean>;

  // ── Actions ─────────────────────────────────────────────────────────────────
  addAlert: (event: string, envelope: WsEventEnvelope) => void;
  updateCenterStatus: (envelope: WsEventEnvelope) => void;
  addOfflineDevice: (envelope: WsEventEnvelope) => void;
  dismissOfflineDevice: (key: string) => void;
  updateTableAiResult: (envelope: WsEventEnvelope<AiResultPayload>) => void;
  updateTableWifiResult: (envelope: WsEventEnvelope<WifiSensingPayload>) => void;
  updateTableAudioLevel: (envelope: WsEventEnvelope<AudioLevelPayload>) => void;
  clearAlerts: () => void;
  markRead: () => void;
  // Enterprise
  updateObjectiveStatus: (envelope: WsEventEnvelope) => void;
  setResourceSaver: (global: boolean, centerId?: string) => void;
  setHybridSource: (config: HybridSourceConfig) => void;
  addConfidencedAlert: (alert: ConfidencedAlert) => void;
}

const MAX_ALERTS = 200;

// ─── Store ────────────────────────────────────────────────────────────────────
export const useAlertsStore = create<AlertsState>((set) => ({
  alerts: [],
  centerStatus: {},
  offlineDevices: [],
  unreadCount: 0,
  tableStatuses: {},
  // Enterprise
  confidencedAlerts: [],
  objectiveStatuses: {},
  hybridSources: {},
  resourceSaverGlobal: false,
  resourceSaverCenters: {},

  updateTableAiResult: (envelope) => {
    const d = envelope.data;
    set((state) => {
      const prev = state.tableStatuses[d.tableId] ?? {};
      const next: TableStatus = {
        tableId:             d.tableId,
        tableName:           d.tableName    ?? prev.tableName    ?? 'Table',
        tableNumber:         d.tableNumber  ?? prev.tableNumber  ?? 0,
        centerId:            envelope.centerId,
        // AI
        agentPresent:        d.agentPresent,
        customerCount:       d.customerCount,
        isFallDetected:      d.isFallDetected,
        isAggressionDetected:d.isAggressionDetected,
        aiConfidence:        d.confidence,
        boundingBoxPx:       d.boundingBoxPx,
        // preserve WiFi + Audio from previous update
        wifiCustomerPresent: prev.wifiCustomerPresent ?? false,
        wifiEstimatedCount:  prev.wifiEstimatedCount  ?? 0,
        waitTimeSeconds:     prev.waitTimeSeconds      ?? 0,
        audioDecibels:       prev.audioDecibels        ?? 0,
        isAudioAlert:        prev.isAudioAlert         ?? false,
        lastUpdated:         envelope.serverTime,
      };
      return { tableStatuses: { ...state.tableStatuses, [d.tableId]: next } };
    });
  },

  updateTableWifiResult: (envelope) => {
    const d = envelope.data;
    set((state) => {
      const prev = state.tableStatuses[d.tableId] ?? {};
      const next: TableStatus = {
        tableId:             d.tableId,
        tableName:           d.tableName   ?? prev.tableName   ?? 'Table',
        tableNumber:         d.tableNumber ?? prev.tableNumber ?? 0,
        centerId:            envelope.centerId,
        // WiFi
        wifiCustomerPresent: d.customerPresent,
        wifiEstimatedCount:  d.estimatedCount,
        waitTimeSeconds:     d.waitTimeSeconds ?? prev.waitTimeSeconds ?? 0,
        // preserve AI + Audio
        agentPresent:        prev.agentPresent        ?? false,
        customerCount:       prev.customerCount        ?? 0,
        isFallDetected:      prev.isFallDetected       ?? false,
        isAggressionDetected:prev.isAggressionDetected ?? false,
        aiConfidence:        prev.aiConfidence         ?? 0,
        boundingBoxPx:       prev.boundingBoxPx,
        audioDecibels:       prev.audioDecibels        ?? 0,
        isAudioAlert:        prev.isAudioAlert         ?? false,
        lastUpdated:         envelope.serverTime,
      };
      return { tableStatuses: { ...state.tableStatuses, [d.tableId]: next } };
    });
  },

  updateTableAudioLevel: (envelope) => {
    const d = envelope.data;
    set((state) => {
      const prev = state.tableStatuses[d.tableId] ?? {};
      const next: TableStatus = {
        tableId:              d.tableId,
        tableName:            d.tableName   ?? prev.tableName   ?? 'Table',
        tableNumber:          prev.tableNumber ?? 0,
        centerId:             envelope.centerId,
        // Audio
        audioDecibels:        d.decibels,
        isAudioAlert:         d.isAlert,
        // preserve AI + WiFi
        agentPresent:         prev.agentPresent        ?? false,
        customerCount:        prev.customerCount        ?? 0,
        isFallDetected:       prev.isFallDetected       ?? false,
        isAggressionDetected: prev.isAggressionDetected ?? false,
        aiConfidence:         prev.aiConfidence         ?? 0,
        boundingBoxPx:        prev.boundingBoxPx,
        wifiCustomerPresent:  prev.wifiCustomerPresent  ?? false,
        wifiEstimatedCount:   prev.wifiEstimatedCount   ?? 0,
        waitTimeSeconds:      prev.waitTimeSeconds       ?? 0,
        lastUpdated:          envelope.serverTime,
      };
      return { tableStatuses: { ...state.tableStatuses, [d.tableId]: next } };
    });
  },

  addAlert: (event, envelope) => {
    const item: AlertItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event,
      centerId:   envelope.centerId,
      centerName: envelope.centerName,
      severity:   envelope.severity,
      serverTime: envelope.serverTime,
      data:       (envelope.data ?? {}) as Record<string, unknown>,
    };
    set((state) => ({
      alerts:      [item, ...state.alerts].slice(0, MAX_ALERTS),
      unreadCount: state.unreadCount + 1,
    }));
  },

  updateCenterStatus: (envelope) => {
    const raw = (envelope.data ?? {}) as Record<string, unknown>;
    const entry: CenterStatusEntry = {
      centerId:   envelope.centerId,
      centerName: envelope.centerName,
      status:     (raw['status'] as CenterStatusEntry['status']) ?? 'ONLINE',
      deviceType: raw['deviceType'] as string | undefined,
      lastSeen:   envelope.serverTime,
    };
    set((state) => ({
      centerStatus: {
        ...state.centerStatus,
        [envelope.centerId]: entry,
      },
    }));
  },

  addOfflineDevice: (envelope) => {
    const raw = (envelope.data ?? {}) as Record<string, unknown>;
    const deviceId = (raw['deviceId'] as string) ?? 'unknown';
    const key = `${envelope.centerId}:${deviceId}`;
    const alert: OfflineDeviceAlert = {
      key,
      deviceId,
      deviceType:  (raw['deviceType'] as string) ?? 'UNKNOWN',
      deviceName:  raw['name'] as string | undefined,
      ipAddress:   raw['ipAddress'] as string | undefined,
      centerId:    envelope.centerId,
      centerName:  envelope.centerName,
      offlineSince: envelope.serverTime,
      dismissed:   false,
    };
    set((state) => ({
      offlineDevices: [
        alert,
        // deduplicate — remove any previous entry with same key
        ...state.offlineDevices.filter((d) => d.key !== key),
      ].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
  },

  dismissOfflineDevice: (key) =>
    set((state) => ({
      offlineDevices: state.offlineDevices.map((d) =>
        d.key === key ? { ...d, dismissed: true } : d
      ),
    })),

  clearAlerts: () => set({ alerts: [], unreadCount: 0 }),
  markRead:    () => set({ unreadCount: 0 }),

  // ── Enterprise actions ───────────────────────────────────────────────────

  addConfidencedAlert: (alert) =>
    set((state) => ({
      confidencedAlerts: [alert, ...state.confidencedAlerts].slice(0, 100),
    })),

  updateObjectiveStatus: (envelope) => {
    const d = (envelope.data ?? {}) as Record<string, unknown>;
    const objectiveId = d['objectiveId'] as number;
    if (!objectiveId) return;
    set((state) => ({
      objectiveStatuses: {
        ...state.objectiveStatuses,
        [objectiveId]: {
          status:    (d['status'] as ObjectiveStatus) ?? 'NORMAL',
          confidence: (d['confidence'] as number) ?? 0,
          lastTech:   (d['tech'] as string) ?? 'CCTV',
          lastSeen:   envelope.serverTime,
        },
      },
    }));
  },

  setResourceSaver: (globalEnabled, centerId) =>
    set((state) =>
      centerId
        ? { resourceSaverCenters: { ...state.resourceSaverCenters, [centerId]: globalEnabled } }
        : { resourceSaverGlobal: globalEnabled }
    ),

  setHybridSource: (config) =>
    set((state) => ({
      hybridSources: { ...state.hybridSources, [config.objectiveId]: config },
    })),
}));
