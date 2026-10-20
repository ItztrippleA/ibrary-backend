import { createHmac, timingSafeEqual } from 'crypto';

export function paystackSignature(secret: string, rawBody: Buffer): string {
  return createHmac('sha512', secret).update(rawBody).digest('hex');
}

export function signaturesMatch(expectedHex: string, received: string | undefined): boolean {
  if (!received) return false;
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
