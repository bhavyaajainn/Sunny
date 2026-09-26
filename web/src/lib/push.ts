// Service worker registration and Web Push subscription.
import { api } from '../data/api';

export type NotifState = NotificationPermission | 'unsupported';

/** True when opened from the Home Screen icon (iOS) or installed as an app. */
export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

/** 'unsupported' covers iOS Safari tabs: Web Push there only works from the Home Screen app. */
export function notifState(): NotifState {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported';
  return Notification.permission;
}

export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch((err: unknown) => {
    console.warn('Service worker registration failed', err);
  });
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function sameKey(a: ArrayBuffer | null, b: Uint8Array): boolean {
  if (!a || a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
}

/**
 * Subscribes this device (or reuses its subscription) and sends it to the server.
 * Safe to call on every launch: the server upserts by endpoint.
 */
export async function subscribePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const { key } = await api<{ key: string }>('GET', '/push/public-key');
  const serverKey = b64urlToBytes(key);

  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub.options.applicationServerKey, serverKey)) {
    // The server's keys changed: the old subscription can't receive our pushes.
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey,
  });
  await api('POST', '/push/subscribe', sub.toJSON());
}
