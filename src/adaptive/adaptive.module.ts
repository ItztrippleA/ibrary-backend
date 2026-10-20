import { Module } from '@nestjs/common';
import { AdaptiveAdminController } from './adaptive-admin.controller';
import { AdaptiveController } from './adaptive.controller';
import { AdaptiveService } from './adaptive.service';

@Module({
  controllers: [AdaptiveController, AdaptiveAdminController],
  providers: [AdaptiveService],
  exports: [AdaptiveService],
})
export class AdaptiveModule {}
