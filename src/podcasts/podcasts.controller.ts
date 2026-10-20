import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { RequestPodcastDto } from './dto';
import { PodcastsService } from './podcasts.service';

@ApiTags('podcasts')
@ApiBearerAuth()
@Controller('podcasts')
export class PodcastsController {
  constructor(private readonly podcasts: PodcastsService) {}

  @Post()
  @ApiOperation({
    summary: 'Ask for a two-host discussion of a topic',
    description:
      'The same topic and focus is stored once and replayed. A blank focus is the overview. Audio is attached when a voice is available.',
  })
  request(@CurrentUser() user: User, @Body() dto: RequestPodcastDto) {
    return this.podcasts.request(user, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Podcast status, script, and audio when it is ready' })
  one(@CurrentUser() user: User, @Param('id') id: string) {
    return this.podcasts.one(id, user);
  }
}
