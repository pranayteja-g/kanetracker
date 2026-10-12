import { Injectable, inject, signal } from '@angular/core';
import { DexieService } from '../services/dexie.service';

const AUTO_LOCK_MS = 30_000;
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * App lock. This is a privacy screen for the local UI, not encryption:
 * data in IndexedDB is not encrypted.
 */
@Injectable({ providedIn: 'root' })
export class LockService {
  private db = inject(DexieService);
  locked = signal(false);
  enabled = signal(false);
  hasBio = signal(false);
  private hiddenAt = 0;
  private fails = 0;
  private wait = 0;

  async init() {
    this.enabled.set(await this.db.getSetting('lockEnabled', false));
    this.hasBio.set(!!(await this.db.getSetting<string>('bioId', '')));
    this.locked.set(this.enabled());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.hiddenAt = Date.now();
      else if (this.enabled() && this.hiddenAt && Date.now() - this.hiddenAt > AUTO_LOCK_MS) this.locked.set(true);
    });
  }

  get bioSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials);
  }

  lockNow() {
    if (this.enabled()) this.locked.set(true);
  }

  private async hash(pin: string, salt: string) {
    return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + pin)));
  }

  async setPin(pin: string) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
    await this.db.setSetting('pinSalt', salt);
    await this.db.setSetting('pinHash', await this.hash(pin, salt));
    await this.db.setSetting('lockEnabled', true);
    this.enabled.set(true);
  }

  async verify(pin: string): Promise<'ok' | 'bad' | 'wait'> {
    if (Date.now() < this.wait) return 'wait';
    const [salt, h] = await Promise.all([this.db.getSetting('pinSalt', ''), this.db.getSetting('pinHash', '')]);
    if (salt && h && (await this.hash(pin, salt)) === h) {
      this.fails = 0;
      this.locked.set(false);
      return 'ok';
    }
    if (++this.fails >= 5) { this.wait = Date.now() + 30_000; this.fails = 0; }
    return 'bad';
  }

  async disable() {
    await Promise.all(['pinHash', 'pinSalt', 'bioId'].map(k => this.db.settings.delete(k)));
    await this.db.setSetting('lockEnabled', false);
    this.enabled.set(false);
    this.hasBio.set(false);
    this.locked.set(false);
  }

  async enableBio(): Promise<boolean> {
    try {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: 'Kanetracker' },
          user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'kanetracker', displayName: 'Kanetracker' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      await this.db.setSetting('bioId', b64(cred.rawId));
      this.hasBio.set(true);
      return true;
    } catch { return false; }
  }

  async disableBio() {
    await this.db.settings.delete('bioId');
    this.hasBio.set(false);
  }

  async unlockBio(): Promise<boolean> {
    try {
      const id = await this.db.getSetting('bioId', '');
      if (!id) return false;
      const r = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{ type: 'public-key', id: unb64(id), transports: ['internal'] }],
          userVerification: 'required',
          timeout: 60_000,
        },
      });
      if (r) this.locked.set(false);
      return !!r;
    } catch { return false; }
  }
}
