import { createHash, randomBytes, randomInt } from 'crypto';

const REFERRAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('hex');
}

export function referralCode(length = 7): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += REFERRAL_ALPHABET[randomInt(REFERRAL_ALPHABET.length)];
  }
  return code;
}

export function paymentReference(): string {
  return `ibr_${randomBytes(12).toString('hex')}`;
}

export function addDuration(from: Date, ttl: string): Date {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    throw new Error(`Unsupported duration: ${ttl}`);
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 's'
      ? amount * 1000
      : unit === 'm'
        ? amount * 60_000
        : unit === 'h'
          ? amount * 3_600_000
          : amount * 86_400_000;
  return new Date(from.getTime() + ms);
}
