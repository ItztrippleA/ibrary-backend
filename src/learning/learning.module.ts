import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { GamificationModule } from '../gamification/gamification.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';

@Module({
  imports: [CatalogModule, GamificationModule],
  controllers: [LearningController],
  providers: [LearningService],
})
export class LearningModule {}
