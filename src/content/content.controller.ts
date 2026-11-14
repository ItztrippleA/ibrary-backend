import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { ContentService } from './content.service';
import { ContentQuery } from './dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Public()
  @Get('catalog')
  @ApiOperation({
    summary: 'Published classes, subjects, themes, topics, and lesson titles',
    description:
      'The same catalogue for every caller. It is not tied to a signed-in student. Lesson bodies are loaded separately.',
  })
  catalog() {
    return this.content.catalog();
  }

  @Public()
  @Get('topics')
  @ApiOperation({ summary: 'Topics in one class, subject, and theme' })
  topics(@Query() query: ContentQuery) {
    return this.content.topics(query);
  }

  @Public()
  @Get('topics/:topicNumber')
  @ApiOperation({ summary: 'One topic, including objectives and glossary' })
  topic(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.topic(topicNumber, query);
  }

  @Public()
  @Get('topics/:topicNumber/subtopics/summary')
  @ApiOperation({ summary: 'Lesson titles for a topic' })
  summaries(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.summaries(topicNumber, query);
  }

  @Public()
  @Get('topics/:topicNumber/subtopics')
  @ApiOperation({ summary: 'Full lessons for a topic' })
  subtopics(@Param('topicNumber', ParseIntPipe) topicNumber: number, @Query() query: ContentQuery) {
    return this.content.subtopics(topicNumber, query);
  }

  @Public()
  @Get('topics/:topicNumber/subtopics/:contentIndex')
  @ApiOperation({ summary: 'One lesson, with markdown and parsed JSON fields' })
  lesson(
    @Param('topicNumber', ParseIntPipe) topicNumber: number,
    @Param('contentIndex', ParseIntPipe) contentIndex: number,
    @Query() query: ContentQuery,
  ) {
    return this.content.lesson(topicNumber, contentIndex, query);
  }
}
