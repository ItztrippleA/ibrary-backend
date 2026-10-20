import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators';
import { SavePromptDto, SaveSubtopicDto, SaveTopicDto } from '../podcasts/dto';
import { AdaptiveService } from './adaptive.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/adaptive')
export class AdaptiveAdminController {
  constructor(private readonly adaptive: AdaptiveService) {}

  @Get()
  @ApiOperation({ summary: 'Topics, practice pool, and learner states' })
  desk() {
    return this.adaptive.desk();
  }

  @Post('topics')
  @ApiOperation({ summary: 'Add a topic to a subject' })
  createTopic(@Body() dto: SaveTopicDto) {
    return this.adaptive.createTopic(dto);
  }

  @Post('topics/:id/subtopics')
  @ApiOperation({ summary: 'Add a subtopic' })
  createSubtopic(@Param('id') id: string, @Body() dto: SaveSubtopicDto) {
    return this.adaptive.createSubtopic(id, dto);
  }

  @Post('prompts')
  @ApiOperation({ summary: 'Add a practice question to a difficulty pool' })
  createPrompt(@Body() dto: SavePromptDto) {
    return this.adaptive.createPrompt(dto);
  }

  @Delete('prompts/:id')
  @ApiOperation({ summary: 'Remove a practice question' })
  removePrompt(@Param('id') id: string) {
    return this.adaptive.removePrompt(id);
  }
}
