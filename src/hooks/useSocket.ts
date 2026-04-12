'use client';

/**
 * useSocket — singleton socket.io hook for the /events namespace.
 *
 * Design decisions:
 *  - Module-level ref holds the singleton socket so multiple components
 *    can call useSocket() without creating duplicate connections.
 *  - Socket is created lazily on first call with a valid accessToken.
 *  - A cleanup guard (`isMounted`) prevents state updates after unmount.
 *  - `on()` / `off()` helpers are returned for clean per-component subscriptions.
 *
 * Backend details (from EventsGateway):
 *  - Namespace  : /events
 *  - Auth       : { token: '<JWT>' } in handshake.auth
 *  - On connect : server auto-joins SUPER_ADMIN → room:super_admin
 *                              ADMIN/AGENT    → room:center:<centerId>
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'
  | 'disconnected';

export interface UseSocketReturn {
  /** The raw socket.io-client Socket instance (null if not yet connected). */
  socket: Socket | null;
  /** Human-readable connection lifecycle status. */
  status: SocketStatus;
  /** Shorthand for status === 'connected'. */
  isConnected: boolean;
  /**
   * Subscribe to a socket event.
   * Returns an unsubscribe function — ideal for useEffect cleanup.
   */
  on: <T = unknown>(event: string, handler: (data: T) => void) => () => void;
  /** Unsubscribe a specific handler (or all handlers) from an event. */
  off: (event: string, handler?: (data: unknown) => void) => void;
}

// ─── Module-level singleton ───────────────────────────────────────────────────
// Keeping the socket outside React state prevents React Strict Mode
// from tearing down and recreating the connection on every render.
let _socket: Socket | null = null;
let _token: string | null = null; // track which token the current socket was created with

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket(): UseSocketReturn {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<SocketStatus>('idle');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!accessToken) {
      // Logout — tear down existing socket
      if (_socket) {
        _socket.disconnect();
        _socket = null;
        _token = null;
      }
      if (mountedRef.current) setStatus('idle');
      return;
    }

    // A socket already exists for this token — don't create another one.
    // We must NOT require _socket.connected here: if the socket is still in the
    // handshake phase (connected === false) and multiple components mount at the
    // same time, each would see connected=false and race to disconnect-and-recreate,
    // producing the rapid connect/disconnect storm visible in the server logs.
    if (_socket && _token === accessToken) {
      if (mountedRef.current) {
        setStatus(_socket.connected ? 'connected' : 'connecting');
      }
      return;
    }

    // Token changed or no socket yet — tear down old socket and create fresh one
    if (_socket) {
      _socket.disconnect();
      _socket = null;
      _token = null;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000';
    const wsNs  = process.env.NEXT_PUBLIC_WS_NAMESPACE ?? '/events';

    const socket = io(`${wsUrl}${wsNs}`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
      reconnectionDelayMax: 6000,
      timeout: 12_000,
      autoConnect: true,
    });

    _socket = socket;
    _token  = accessToken;

    if (mountedRef.current) setStatus('connecting');

    socket.on('connect', () => {
      console.info('[Socket] ✅ connected  id=%s', socket.id);
      if (mountedRef.current) setStatus('connected');
    });

    socket.on('disconnect', (reason) => {
      console.info('[Socket] disconnected  reason=%s', reason);
      if (mountedRef.current) setStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] connect_error:', err.message);
      if (mountedRef.current) setStatus('error');
    });

    // Manager-level reconnection events
    socket.io.on('reconnect_attempt', () => {
      if (mountedRef.current) setStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      if (mountedRef.current) setStatus('connected');
    });

    // No cleanup teardown here — the singleton lives across component remounts.
    // It is torn down only when the token changes (logout/re-login).
  }, [accessToken]);

  // ── Stable helpers ──────────────────────────────────────────────────────────
  const on = useCallback(<T = unknown>(event: string, handler: (data: T) => void) => {
    _socket?.on(event, handler as (data: unknown) => void);
    // Return an unsubscribe function for useEffect cleanup
    return () => {
      _socket?.off(event, handler as (data: unknown) => void);
    };
  }, []);

  const off = useCallback((event: string, handler?: (data: unknown) => void) => {
    if (handler) {
      _socket?.off(event, handler);
    } else {
      _socket?.removeAllListeners(event);
    }
  }, []);

  return {
    socket: _socket,
    status,
    isConnected: status === 'connected',
    on,
    off,
  };
}
