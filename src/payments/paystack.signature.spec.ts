import { paystackSignature, signaturesMatch } from './paystack.signature';

describe('paystack signature', () => {
  it('matches the HMAC Paystack sends in x-paystack-signature', () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const signature = paystackSignature('sk_test', body);
    expect(signaturesMatch(signature, signature)).toBe(true);
    expect(signaturesMatch(signature, 'nope')).toBe(false);
    expect(signaturesMatch(signature, undefined)).toBe(false);
  });
});
