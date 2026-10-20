import { Module } from '@nestjs/common';
import { AccessAdminController } from './access-admin.controller';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';

@Module({
  controllers: [AccessController, AccessAdminController],
  providers: [AccessService],
})
export class AccessModule {}
