// Web Push using WebCrypto only (runs on Cloudflare Workers, no Node crypto):
//  - RFC 8291 message encryption (aes128gcm content coding, RFC 8188)
//  - RFC 8292 VAPID authentication (ES256 JWT)

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

async function hkdf(
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Encrypts `plaintext` for a push subscription (RFC 8291). Returns the complete request body:
 * salt(16) | record size(4) | key id length(1) | sender public key(65) | ciphertext.
 */
export async function encryptPayload(
  plaintext: Uint8Array,
  p256dh: string,
  auth: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = b64urlDecode(p256dh);
  const authSecret = b64urlDecode(auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) {
    throw new Error('Subscription keys have the wrong length');
  }

  // Ephemeral sender key pair and the ECDH shared secret.
  const sender = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const senderPublic = new Uint8Array(
    (await crypto.subtle.exportKey('raw', sender.publicKey)) as ArrayBuffer,
  );
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // `public` is the WebCrypto field name; workers-types spells it `$public`.
      { name: 'ECDH', public: uaKey, $public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      sender.privateKey,
      256,
    ),
  );

  // RFC 8291 §3.3–3.4: combine with the auth secret, then derive key and nonce.
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, senderPublic);
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const cek = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aes128gcm\0')), 16);
  const nonce = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce\0')), 12);

  // One record: plaintext + 0x02 padding delimiter (last record).
  const record = concat(plaintext, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, record),
  );

  const header = new Uint8Array(new ArrayBuffer(21));
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, ciphertext);
}

export interface Vapid {
  /** Uncompressed P-256 public key, base64url (65 bytes). */
  publicKey: string;
  /** Private scalar `d`, base64url (32 bytes). */
  privateKey: string;
  /** mailto: or https: contact for the push service. */
  subject: string;
}

/** Builds the `Authorization: vapid t=…, k=…` header for an endpoint (RFC 8292). */
export async function vapidAuthorization(
  endpoint: string,
  vapid: Vapid,
  now = Date.now(),
): Promise<string> {
  const pub = b64urlDecode(vapid.publicKey);
  if (pub.length !== 65) throw new Error('VAPID_PUBLIC_KEY must be a 65-byte P-256 key');
  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: vapid.privateKey,
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 60 * 60,
        sub: vapid.subject,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  // WebCrypto ECDSA signatures are already raw r||s, which is what JWS ES256 expects.
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${vapid.publicKey}`;
}

export interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  status: number;
  ok: boolean;
  /** 404/410: the subscription is dead and should be deleted. */
  gone: boolean;
  detail: string;
}

export async function sendPush(
  sub: Subscription,
  payload: string,
  vapid: Vapid,
  ttlSeconds = 60 * 60,
): Promise<PushResult> {
  const body = await encryptPayload(enc.encode(payload), sub.p256dh, sub.auth);
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthorization(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttlSeconds),
      Urgency: 'high',
    },
    body,
  });
  const detail = res.ok ? '' : (await res.text()).slice(0, 300);
  return {
    status: res.status,
    ok: res.ok,
    gone: res.status === 404 || res.status === 410,
    detail,
  };
}
