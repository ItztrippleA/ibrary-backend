import { Module } from '@nestjs/common';
import { readEnv } from '../config/env';
import { LocalObjectStorage } from './local-object-storage';
import { OBJECT_STORAGE } from './object-storage';
import { S3ObjectStorage } from './s3-object-storage';

@Module({
  providers: [
    {
      provide: OBJECT_STORAGE,
      useFactory: () => {
        const env = readEnv();
        return env.storageDriver === 's3' ? new S3ObjectStorage(env) : new LocalObjectStorage(env);
      },
    },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
