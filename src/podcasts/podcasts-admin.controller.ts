import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RequestPodcastDto } from './dto';
import { PodcastsService } from './podcasts.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/podcasts')
export class PodcastsAdminController {
  constructor(
    private readonly podcasts: PodcastsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Podcast episodes and the topics they can use' })
  async desk() {
    const [episodes, topics, voices] = await Promise.all([
      this.podcasts.list(),
      this.prisma.topic.findMany({
        orderBy: { title: 'asc' },
        include: {
          subject: { select: { name: true, classLevel: true, term: true } },
          subtopics: { orderBy: { sort: 'asc' }, select: { id: true, title: true } },
        },
      }),
      this.podcasts.voices(),
    ]);
    return { episodes, topics, voices };
  }

  @Post()
  @ApiOperation({ summary: 'Generate or replay a podcast for a topic or subtopic' })
  request(@CurrentUser() user: User, @Body() dto: RequestPodcastDto) {
    return this.podcasts.request(user, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a cached podcast' })
  remove(@Param('id') id: string) {
    return this.podcasts.remove(id);
  }
}
