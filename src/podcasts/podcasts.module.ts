import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PodcastsAdminController } from './podcasts-admin.controller';
import { PodcastsController } from './podcasts.controller';
import { PodcastsService } from './podcasts.service';

@Module({
  imports: [StorageModule],
  controllers: [PodcastsController, PodcastsAdminController],
  providers: [PodcastsService],
})
export class PodcastsModule {}
