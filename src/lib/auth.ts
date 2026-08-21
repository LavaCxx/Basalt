interface TimingSafeSubtleCrypto extends SubtleCrypto {
  timingSafeEqual(a: ArrayBuffer | ArrayBufferView, b: ArrayBuffer | ArrayBufferView): boolean;
}

/**
 * Verify a Bearer token without leaking the expected token's length or value
 * through a short-circuiting string comparison.
 */
export async function verifyBearerToken(request: Request, expectedToken: unknown): Promise<boolean> {
  if (typeof expectedToken !== 'string' || expectedToken.length === 0) return false;

  const authorization = request.headers.get('authorization') || '';
  const providedToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : '';

  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(providedToken)),
    crypto.subtle.digest('SHA-256', encoder.encode(expectedToken)),
  ]);

  return (crypto.subtle as TimingSafeSubtleCrypto).timingSafeEqual(providedHash, expectedHash);
}
