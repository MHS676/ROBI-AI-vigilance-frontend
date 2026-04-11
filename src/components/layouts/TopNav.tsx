'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, Settings, LogOut, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface TopNavProps {
  title?: string;
}

export default function TopNav({ title }: TopNavProps) {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <header className="h-16 shrink-0 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm flex items-center px-6 gap-4 z-10">
      {/* Page title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="text-sm font-semibold text-white truncate">{title}</h1>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <button
          className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full ring-2 ring-slate-950" />
        </button>

        {/* Settings */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-all"
          aria-label="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* User menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2.5 pl-2 pr-2 h-9 rounded-lg hover:bg-slate-800 transition-all',
              dropdownOpen && 'bg-slate-800',
            )}
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials || '??'}
            </div>

            {/* Name + role */}
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-white leading-none">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-none">
                {user?.role ? ROLE_LABELS[user.role] : ''}
              </p>
            </div>

            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-slate-500 transition-transform duration-150',
                dropdownOpen && 'rotate-180',
              )}
            />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 py-1.5 z-50 animate-fade-in">
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-slate-800">
                <p className="text-xs font-medium text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors">
                  <Settings className="w-4 h-4 shrink-0" />
                  Account Settings
                </button>
              </div>

              {/* Sign out */}
              <div className="border-t border-slate-800 pt-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
