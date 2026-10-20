import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { AnswerPromptDto, CoachDto } from '../podcasts/dto';
import { AdaptiveService } from './adaptive.service';

@ApiTags('adaptive')
@ApiBearerAuth()
@Controller()
export class AdaptiveController {
  constructor(private readonly adaptive: AdaptiveService) {}

  @Get('catalog/subjects/:id/topics')
  @ApiOperation({ summary: 'Topics and subtopics for a subject' })
  topics(@Param('id') id: string) {
    return this.adaptive.topics(id);
  }

  @Get('topics/:id')
  @ApiOperation({ summary: 'One topic, without practice answers' })
  topic(@Param('id') id: string) {
    return this.adaptive.topic(id);
  }

  @Get('adaptive/recommendations')
  @ApiOperation({ summary: 'Topics that need another pass, or a first listen' })
  recommendations(@CurrentUser() user: User) {
    return this.adaptive.recommendations(user.id);
  }

  @Get('adaptive/topics/:id/next')
  @ApiOperation({ summary: 'Next practice question for this student and topic' })
  next(@CurrentUser() user: User, @Param('id') id: string) {
    return this.adaptive.next(user, id);
  }

  @Post('adaptive/topics/:id/answers')
  @ApiOperation({ summary: 'Mark a practice answer and update competency. The correct option is not returned.' })
  answer(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: AnswerPromptDto) {
    return this.adaptive.answer(user, id, dto);
  }

  @Post('adaptive/topics/:id/coach')
  @ApiOperation({ summary: 'A coach note that asks a question and does not give the answer' })
  coach(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: CoachDto) {
    return this.adaptive.coach(user, id, dto.note);
  }
}
