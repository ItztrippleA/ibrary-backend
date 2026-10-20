import { ServiceUnavailableException } from '@nestjs/common';
import type { AppEnv } from '../config/env';
import type { ObjectStorage, StoredFile, StoredObject } from './object-storage';

/** Swap this body for PutObject when AWS is connected. Public URL is AWS_S3_PUBLIC_URL plus the key. */
export class S3ObjectStorage implements ObjectStorage {
  constructor(private readonly env: AppEnv) {}

  async put(_file: StoredFile): Promise<StoredObject> {
    if (!this.env.s3Bucket || !this.env.s3Region || !this.env.s3PublicUrl) {
      throw new ServiceUnavailableException(
        'S3 storage needs AWS_S3_BUCKET, AWS_S3_REGION, and AWS_S3_PUBLIC_URL.',
      );
    }
    throw new ServiceUnavailableException(
      'S3 upload is not connected yet. Keep STORAGE_DRIVER=local until AWS is wired.',
    );
  }
}
