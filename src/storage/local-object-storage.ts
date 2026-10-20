import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { AppEnv } from '../config/env';
import type { ObjectStorage, StoredFile, StoredObject } from './object-storage';

export class LocalObjectStorage implements ObjectStorage {
  constructor(private readonly env: AppEnv) {}

  async put(file: StoredFile): Promise<StoredObject> {
    const key = `${file.folder}/${file.filename}`;
    const path = join(process.cwd(), 'uploads', key);
    await mkdir(join(process.cwd(), 'uploads', file.folder), { recursive: true });
    await writeFile(path, file.body);
    return { key, url: `${this.env.appUrl}/uploads/${key}` };
  }
}
