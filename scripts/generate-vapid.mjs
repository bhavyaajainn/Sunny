// Generates a VAPID key pair for Web Push (P-256).
// Usage:
//   node scripts/generate-vapid.mjs            → prints both keys
//   node scripts/generate-vapid.mjs --dev-vars → also writes worker/.dev.vars (git-ignored)
// Put VAPID_PUBLIC_KEY in worker/wrangler.toml [vars]. The private key is a secret:
//   cd worker && npx wrangler secret put VAPID_PRIVATE_KEY
import { webcrypto } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const { subtle } = webcrypto;
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const publicKey = Buffer.from(await subtle.exportKey('raw', kp.publicKey)).toString('base64url');
const { d: privateKey } = await subtle.exportKey('jwk', kp.privateKey);

if (process.argv.includes('--dev-vars')) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '../worker/.dev.vars');
  await writeFile(file, `VAPID_PRIVATE_KEY=${privateKey}\nVAPID_PUBLIC_KEY=${publicKey}\n`, {
    mode: 0o600,
  });
  console.log(`Wrote ${file}`);
}

console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('\nKeep the private key secret. Never commit it.');
