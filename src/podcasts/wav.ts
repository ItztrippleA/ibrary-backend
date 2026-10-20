type WavAudio = {
  sampleRate: number;
  channels: number;
  bits: number;
  data: Buffer;
};

export function parseWav(buffer: Buffer): WavAudio {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  let data: Buffer | null = null;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > buffer.length) break;
    if (id === 'fmt ') {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bits = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      data = buffer.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!data || !sampleRate || !channels || !bits) throw new Error('WAV is missing audio data');
  return { sampleRate, channels, bits, data: Buffer.from(data) };
}

export function encodeWav(audio: WavAudio): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + audio.data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(audio.channels, 22);
  header.writeUInt32LE(audio.sampleRate, 24);
  const byteRate = audio.sampleRate * audio.channels * (audio.bits / 8);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(audio.channels * (audio.bits / 8), 32);
  header.writeUInt16LE(audio.bits, 34);
  header.write('data', 36);
  header.writeUInt32LE(audio.data.length, 40);
  return Buffer.concat([header, audio.data]);
}

export function concatWav(buffers: Buffer[]): Buffer {
  const parts = buffers.map(parseWav);
  const first = parts[0];
  if (!first) throw new Error('No audio to join');
  for (const part of parts) {
    if (
      part.sampleRate !== first.sampleRate ||
      part.channels !== first.channels ||
      part.bits !== first.bits
    ) {
      throw new Error('Audio pieces do not share one format');
    }
  }
  return encodeWav({ ...first, data: Buffer.concat(parts.map((part) => part.data)) });
}
