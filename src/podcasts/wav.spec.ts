import { concatWav, encodeWav, parseWav } from './wav';

function tone(length: number) {
  return encodeWav({
    sampleRate: 22050,
    channels: 1,
    bits: 16,
    data: Buffer.alloc(length, 1),
  });
}

describe('wav', () => {
  it('joins pieces that share one format', () => {
    const joined = concatWav([tone(8), tone(4)]);
    const parsed = parseWav(joined);
    expect(parsed.sampleRate).toBe(22050);
    expect(parsed.data.length).toBe(12);
  });
});
