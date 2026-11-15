import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators';
import { ContentService } from './content.service';
import { ContentQuery } from './dto';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/content')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  @Get('catalog')
  @ApiOperation({ summary: 'Published lesson catalogue for the admin desk' })
  catalog() {
    return this.content.catalog(true);
  }

  @Get('topics')
  @ApiOperation({ summary: 'Topics in one class, subject, and theme' })
  topics(@Query() query: ContentQuery) {
    return this.content.topics(query);
  }

  @Get('topics/:topicNumber')
  @ApiOperation({ summary: 'One published topic' })
  topic(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.topic(topicNumber, query);
  }

  @Get('topics/:topicNumber/subtopics/summary')
  @ApiOperation({ summary: 'Lesson titles for a published topic' })
  summaries(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.summaries(topicNumber, query);
  }

  @Get('topics/:topicNumber/subtopics')
  @ApiOperation({ summary: 'Full lessons for a published topic' })
  subtopics(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.subtopics(topicNumber, query);
  }

  @Get('topics/:topicNumber/subtopics/:contentIndex')
  // Proxies Content API get_subtopic (v2) — markdown, takeaways, glossary, activities, images.
  @ApiOperation({ summary: 'One published lesson' })
  lesson(
    @Param('topicNumber', ParseIntPipe) topicNumber: number,
    @Param('contentIndex', ParseIntPipe) contentIndex: number,
    @Query() query: ContentQuery,
  ) {
    return this.content.lesson(topicNumber, contentIndex, query);
  }
}
