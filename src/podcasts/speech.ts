import { execFile } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import type { AppEnv } from '../config/env';
import type { Turn } from './lesson';
import { concatWav } from './wav';

const exec = promisify(execFile);

export type Spoken = {
  body: Buffer;
  contentType: string;
  extension: string;
  source: 'SYSTEM' | 'OPENAI';
};

const GUIDE_VOICE = 'Daniel';
const STUDENT_VOICE = 'Moira';

export async function systemVoiceAvailable() {
  try {
    await exec('which', ['say']);
    return true;
  } catch {
    return false;
  }
}

export async function speakTurns(turns: Turn[], env: AppEnv): Promise<Spoken | null> {
  if (env.openaiApiKey) {
    try {
      const spoken = await speakOpenAi(turns, env);
      if (spoken) return spoken;
    } catch {
      // A failed voice request still leaves the script to play as text.
    }
  }
  if (await systemVoiceAvailable()) {
    try {
      return await speakSystem(turns);
    } catch {
      return null;
    }
  }
  return null;
}

async function speakOpenAi(turns: Turn[], env: AppEnv): Promise<Spoken | null> {
  const pieces: Buffer[] = [];
  for (const turn of turns) {
    const voice = turn.speaker === 'guide' ? env.openaiGuideVoice : env.openaiStudentVoice;
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.openaiTtsModel,
        voice,
        input: turn.text,
        response_format: 'mp3',
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) return null;
    pieces.push(Buffer.from(await response.arrayBuffer()));
  }
  return {
    body: Buffer.concat(pieces),
    contentType: 'audio/mpeg',
    extension: 'mp3',
    source: 'OPENAI',
  };
}

async function speakSystem(turns: Turn[]): Promise<Spoken> {
  const dir = await mkdtemp(join(tmpdir(), 'ibrary-podcast-'));
  try {
    const pieces: Buffer[] = [];
    for (const [index, turn] of turns.entries()) {
      const file = join(dir, `${index}.wav`);
      const voice = turn.speaker === 'guide' ? GUIDE_VOICE : STUDENT_VOICE;
      await exec('say', ['-v', voice, '-o', file, '--data-format=LEI16@22050', turn.text], {
        timeout: 60_000,
      });
      pieces.push(await readFile(file));
    }
    return {
      body: concatWav(pieces),
      contentType: 'audio/wav',
      extension: 'wav',
      source: 'SYSTEM',
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
