// Checks our WebCrypto Web Push against independent implementations:
// http_ece (Mozilla's reference aes128gcm library) decrypts, Node's crypto verifies the JWT.
import { createECDH, createPublicKey, randomBytes, verify } from 'node:crypto';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { b64urlDecode, b64urlEncode, encryptPayload, vapidAuthorization } from '../src/push';

const require = createRequire(import.meta.url);
const ece = require('http_ece') as {
  decrypt(
    buf: Buffer,
    params: { version: string; privateKey: ReturnType<typeof createECDH>; authSecret: Buffer },
  ): Buffer;
};

function browserKeys() {
  const ua = createECDH('prime256v1');
  ua.generateKeys();
  const auth = randomBytes(16);
  return {
    ua,
    auth,
    p256dh: b64urlEncode(new Uint8Array(ua.getPublicKey())),
    authB64: b64urlEncode(new Uint8Array(auth)),
  };
}

describe('encryptPayload (RFC 8291)', () => {
  it('produces aes128gcm that the reference library decrypts', async () => {
    const k = browserKeys();
    const msg = JSON.stringify({
      title: '☀️ Your morning boost is here',
      body: 'I choose calm. 🌿',
    });
    const body = await encryptPayload(new TextEncoder().encode(msg), k.p256dh, k.authB64);
    const plain = ece.decrypt(Buffer.from(body), {
      version: 'aes128gcm',
      privateKey: k.ua,
      authSecret: k.auth,
    });
    expect(new TextDecoder().decode(plain)).toBe(msg);
  });

  it('writes the RFC 8188 header: salt, rs = 4096, 65-byte sender key', async () => {
    const k = browserKeys();
    const body = await encryptPayload(new Uint8Array([1, 2, 3]), k.p256dh, k.authB64);
    const view = new DataView(body.buffer);
    expect(view.getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    expect(body[21]).toBe(4); // uncompressed EC point
    expect(body.length).toBe(16 + 4 + 1 + 65 + 3 + 1 + 16); // + delimiter + GCM tag
  });

  it('uses a fresh salt and key each time', async () => {
    const k = browserKeys();
    const a = await encryptPayload(new Uint8Array([1]), k.p256dh, k.authB64);
    const b = await encryptPayload(new Uint8Array([1]), k.p256dh, k.authB64);
    expect(Buffer.from(a.slice(0, 86)).equals(Buffer.from(b.slice(0, 86)))).toBe(false);
  });

  it('rejects malformed subscription keys', async () => {
    await expect(encryptPayload(new Uint8Array([1]), 'AAAA', 'AAAA')).rejects.toThrow();
  });
});

describe('vapidAuthorization (RFC 8292)', () => {
  it('signs an ES256 JWT that verifies with the public key', async () => {
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
    ]);
    const publicKey = b64urlEncode(
      new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)),
    );
    const { d } = await crypto.subtle.exportKey('jwk', kp.privateKey);
    const now = Date.UTC(2026, 8, 26, 2, 0);
    const header = await vapidAuthorization(
      'https://web.push.apple.com/QGuQyavXutnMb/abc',
      { publicKey, privateKey: d ?? '', subject: 'https://sunny.example.workers.dev' },
      now,
    );

    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(m).not.toBeNull();
    const [, h, c, sig, k] = m as unknown as [string, string, string, string, string];
    expect(k).toBe(publicKey);
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString()) as Record<string, unknown>;
    expect(claims).toEqual({
      aud: 'https://web.push.apple.com',
      exp: now / 1000 + 12 * 3600,
      sub: 'https://sunny.example.workers.dev',
    });

    const pub = b64urlDecode(publicKey);
    const nodeKey = createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: b64urlEncode(pub.slice(1, 33)),
        y: b64urlEncode(pub.slice(33)),
      },
      format: 'jwk',
    });
    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${c}`),
      { key: nodeKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig, 'base64url'),
    );
    expect(ok).toBe(true);
  });
});
