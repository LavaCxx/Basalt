import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyBearerToken } from '../src/lib/auth';

const nativeCrypto = globalThis.crypto;

function installWorkerCrypto() {
  vi.stubGlobal('crypto', {
    subtle: {
      digest: nativeCrypto.subtle.digest.bind(nativeCrypto.subtle),
      timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer) {
        const left = new Uint8Array(a);
        const right = new Uint8Array(b);
        let difference = left.length ^ right.length;
        for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
          difference |= (left[index] || 0) ^ (right[index] || 0);
        }
        return difference === 0;
      },
    },
  });
}

describe('verifyBearerToken', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts the configured bearer token', async () => {
    installWorkerCrypto();
    const request = new Request('https://example.com/sync', {
      headers: { Authorization: 'Bearer correct-token' },
    });

    await expect(verifyBearerToken(request, 'correct-token')).resolves.toBe(true);
  });

  it('rejects missing, incorrect, and unconfigured tokens', async () => {
    installWorkerCrypto();
    const missing = new Request('https://example.com/sync');
    const incorrect = new Request('https://example.com/sync', {
      headers: { Authorization: 'Bearer wrong-token' },
    });

    await expect(verifyBearerToken(missing, 'correct-token')).resolves.toBe(false);
    await expect(verifyBearerToken(incorrect, 'correct-token')).resolves.toBe(false);
    await expect(verifyBearerToken(incorrect, undefined)).resolves.toBe(false);
  });
});
