import { Injectable } from '@nestjs/common';
import { readEnv } from '../config/env';

export class ContentUpstreamError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly api: string,
    readonly token: string,
  ) {
    super(message);
  }
}

@Injectable()
export class ContentClient {
  async get<T>(path: string, query: Record<string, string | number>): Promise<T> {
    const env = readEnv();
    const url = new URL(path, `${env.contentApiUrl}/`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    if (!env.contentApiKey) {
      throw new ContentUpstreamError(503, 'The content API key is not configured', url.toString(), '');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(url, {
        headers: { 'X-API-Key': env.contentApiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        let detail = text.slice(0, 500);
        try {
          const parsed = JSON.parse(text) as { detail?: string };
          if (parsed.detail) detail = parsed.detail;
        } catch {
          detail = text.slice(0, 500);
        }
        throw new ContentUpstreamError(response.status, detail, url.toString(), env.contentApiKey);
      }
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof ContentUpstreamError) throw error;
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ContentUpstreamError(
        503,
        aborted ? 'The content API timed out' : 'The content API did not respond',
        url.toString(),
        env.contentApiKey,
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
