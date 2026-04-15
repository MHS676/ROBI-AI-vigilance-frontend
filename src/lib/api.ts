import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import Cookies from 'js-cookie';
import type {
  AuthResponse,
  Center,
  User,
  LoginDto,
  Camera,
  EspNode,
  Microphone,
  Table,
  HardwareInventory,
  DeviceInventory,
  InventoryStats,
  DiscoveredCamera,
  AssignDeviceDto,
  RejectDeviceDto,
  ScanCamerasDto,
  AddDiscoveredCameraDto,
  InventoryStatus,
  InventoryDeviceType,
} from '@/types';
import { TOKEN_COOKIE_KEY } from './constants';

// ─── DTO used for POST /mapping/link-table ────────────────────────────────────
export interface LinkTableDto {
  centerId: string;
  tableId: string;
  cameraId: string;
  /** Pixel-space bounding box — x/y/w/h are integer pixels on the canvas frame */
  boundingBox: { x: number; y: number; w: number; h: number };
  microphoneId: string;
  agentId: string;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

// ─── Axios instance ───────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ── Request interceptor: attach JWT Bearer token ──────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get(TOKEN_COOKIE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: handle global 401 ───────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      Cookies.remove(TOKEN_COOKIE_KEY);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (dto: LoginDto) =>
    apiClient.post<AuthResponse>('/auth/login', dto),
};

// ─── Centers API ──────────────────────────────────────────────────────────────
export const centersApi = {
  getAll: (params?: { isActive?: boolean; page?: number; limit?: number }) =>
    apiClient.get<Center[]>('/centers', { params }),
  getOne: (id: string) =>
    apiClient.get<Center>(`/centers/${id}`),
  create: (formData: FormData) =>
    apiClient.post<Center>('/centers', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (
    id: string,
    dto: Partial<{
      name: string; code: string; address: string; city: string;
      state: string; country: string; phone: string; isActive: boolean;
    }>,
  ) => apiClient.patch<Center>(`/centers/${id}`, dto),
  remove: (id: string) => apiClient.delete<Center>(`/centers/${id}`),
  getHardware: (centerId: string) =>
    apiClient.get<HardwareInventory>(`/centers/${centerId}/hardware`),
  // Sub-resource endpoints added by CentersController (Phase 7)
  getCameras:     (id: string) => apiClient.get<Camera[]>     (`/centers/${id}/cameras`),
  getTables:      (id: string) => apiClient.get<Table[]>      (`/centers/${id}/tables`),
  getMicrophones: (id: string) => apiClient.get<Microphone[]> (`/centers/${id}/microphones`),
};

// ─── Users API ────────────────────────────────────────────────────────────────
export const usersApi = {
  getMe:  () => apiClient.get<User>('/users/me'),
  getAll: (params?: { centerId?: string; role?: string }) =>
    apiClient.get<User[]>('/users', { params }),
  getOne: (id: string) => apiClient.get<User>(`/users/${id}`),
};

// ─── Mapping API ──────────────────────────────────────────────────────────────
export const mappingApi = {
  linkTable:       (dto: LinkTableDto) => apiClient.post('/mapping/link-table', dto),
  getCenterMapping:(centerId: string)  => apiClient.get(`/mapping/center/${centerId}`),
  getTableMapping: (tableId: string)   => apiClient.get(`/mapping/table/${tableId}`),
  unlinkTable:     (tableId: string)   => apiClient.delete(`/mapping/unlink-table/${tableId}`),
};

// ─── Cameras API ──────────────────────────────────────────────────────────────
export const camerasApi = {
  getAll: (params?: { centerId?: string; status?: string }) =>
    apiClient.get<Camera[]>('/cameras', { params }),
  getOne: (id: string) =>
    apiClient.get<Camera>(`/cameras/${id}`),
  create: (dto: { name: string; rtspUrl: string; ipAddress?: string; model?: string; centerId: string }) =>
    apiClient.post<Camera>('/cameras', dto),
  ping: (id: string) =>
    apiClient.post<{ status: string; latencyMs: number | null; ip: string }>(`/cameras/${id}/ping`),
  /** Update the enabled AI inference features for a camera (persists + notifies AI worker) */
  updateAiFeatures: (id: string, aiFeatures: import('@/types').AiFeature[]) =>
    apiClient.patch<Camera>(`/cameras/${id}/ai-features`, { aiFeatures }),
  remove: (id: string) =>
    apiClient.delete(`/cameras/${id}`),
};

// ─── ESP Nodes API ────────────────────────────────────────────────────────────
export const espNodesApi = {
  getAll: (params?: { centerId?: string; status?: string }) =>
    apiClient.get<EspNode[]>('/esp-nodes', { params }),
  getOne: (id: string) =>
    apiClient.get<EspNode>(`/esp-nodes/${id}`),
  create: (dto: { name: string; macAddress: string; ipAddress?: string; firmwareVer?: string; centerId: string }) =>
    apiClient.post<EspNode>('/esp-nodes', dto),
  ping: (id: string) =>
    apiClient.post<{ status: string; latencyMs: number | null; ip: string }>(`/esp-nodes/${id}/ping`),
  remove: (id: string) =>
    apiClient.delete(`/esp-nodes/${id}`),
};

// ─── Microphones API ──────────────────────────────────────────────────────────
export const microphonesApi = {
  getAll: (params?: { centerId?: string; status?: string }) =>
    apiClient.get<import('@/types').Microphone[]>('/microphones', { params }),
  getOne: (id: string) =>
    apiClient.get<import('@/types').Microphone>(`/microphones/${id}`),
  create: (dto: { name: string; channel: 'LEFT' | 'RIGHT'; ipAddress?: string; model?: string; centerId: string }) =>
    apiClient.post<import('@/types').Microphone>('/microphones', dto),
  ping: (id: string) =>
    apiClient.post<{ status: string; latencyMs: number | null; ip: string }>(`/microphones/${id}/ping`),
  remove: (id: string) =>
    apiClient.delete(`/microphones/${id}`),
};

// ─── Tables API ───────────────────────────────────────────────────────────────
export const tablesApi = {
  getAll: (params?: { centerId?: string }) =>
    apiClient.get<import('@/types').Table[]>('/tables', { params }),
  getOne: (id: string) =>
    apiClient.get<import('@/types').Table>(`/tables/${id}`),
  getByAgent: (agentId: string) =>
    apiClient.get<import('@/types').Table[]>(`/tables/by-agent/${agentId}`),
};
// ─── Provisioning API ─────────────────────────────────────────────────────────
export const provisioningApi = {
  // ── Statistics ──────────────────────────────────────────────────────────────
  getStats: () =>
    apiClient.get<InventoryStats>('/provisioning/stats'),

  // ── Device Inventory ────────────────────────────────────────────────────────
  getAllDevices: (params?: {
    status?: InventoryStatus;
    deviceType?: InventoryDeviceType;
    centerId?: string;
  }) => apiClient.get<DeviceInventory[]>('/provisioning/devices', { params }),

  getPendingDevices: () =>
    apiClient.get<DeviceInventory[]>('/provisioning/devices/pending'),

  getDevice: (id: string) =>
    apiClient.get<DeviceInventory>(`/provisioning/devices/${id}`),

  // ── Approval Workflow ────────────────────────────────────────────────────────
  assignDevice: (id: string, dto: AssignDeviceDto) =>
    apiClient.post<DeviceInventory>(`/provisioning/devices/${id}/assign`, dto),

  rejectDevice: (id: string, dto: RejectDeviceDto) =>
    apiClient.post<DeviceInventory>(`/provisioning/devices/${id}/reject`, dto),

  reprovisionDevice: (id: string, dto: AssignDeviceDto) =>
    apiClient.post<DeviceInventory>(`/provisioning/devices/${id}/reprovision`, dto),

  // ── Camera Discovery ─────────────────────────────────────────────────────────
  scanCameras: (dto: ScanCamerasDto) =>
    apiClient.post<DiscoveredCamera[]>('/provisioning/cameras/scan', dto),

  addDiscoveredCamera: (dto: AddDiscoveredCameraDto) =>
    apiClient.post<Camera>('/provisioning/cameras/add', dto),
};