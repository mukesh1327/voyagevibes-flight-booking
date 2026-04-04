import { Injectable, computed, signal } from '@angular/core';

import type { CorpSession, DeviceInfo } from '../models/domain.models';

const STORAGE_KEY = 'voyagevibes-corp-session';

@Injectable({ providedIn: 'root' })
export class CorpSessionService {
  private readonly sessionState = signal<CorpSession | null>(this.restore());

  readonly session = this.sessionState.asReadonly();
  readonly isAuthenticated = computed(() => this.sessionState() !== null);

  setSession(session: CorpSession): void {
    this.sessionState.set(session);
    this.persist(session);
  }

  clearSession(): void {
    this.sessionState.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  currentUserId(): string {
    return this.sessionState()?.user.userId || 'OPS-DEMO-1';
  }

  createDeviceInfo(email: string): DeviceInfo {
    const now = Date.now().toString(36);
    return {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'voyagevibes-corp-ui',
      ip: '127.0.0.1',
      deviceId: `${email}-${now}`.replace(/[^a-zA-Z0-9-]/g, '-'),
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'web' : 'server',
    };
  }

  private restore(): CorpSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as CorpSession;
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  private persist(session: CorpSession): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}
