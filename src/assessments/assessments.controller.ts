import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { AssessmentsService } from './assessments.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

@ApiTags('assessments')
@ApiBearerAuth()
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'Assessments for this student',
    description: 'Onboarding plus later assessments for the student\'s class. Correct answers are not included.',
  })
  list(@CurrentUser() user: User) {
    return this.assessments.list(user);
  }

  @Public()
  @Get('practice')
  @ApiOperation({
    summary: 'Practice quiz catalog for Assessment tab',
    description: 'Grouped by subject. Optional class_name (SS1 / SSS 1) and subject filters.',
  })
  @ApiQuery({ name: 'class_name', required: false })
  @ApiQuery({ name: 'subject', required: false })
  practiceCatalog(
    @Query('class_name') className?: string,
    @Query('subject') subject?: string,
  ) {
    return this.assessments.practiceCatalog(className, subject);
  }

  @Public()
  @Get('practice/:slug')
  @ApiOperation({
    summary: 'One practice quiz with answer key',
    description: 'Used by the Assessment tab for client-side scoring.',
  })
  practiceQuiz(@Param('slug') slug: string) {
    return this.assessments.practiceQuiz(slug);
  }

  @Get('onboarding')
  @ApiOperation({
    summary: 'Onboarding assessment',
    description:
      'Asked after account creation. Class and class-path answers are saved onto the profile.',
  })
  onboarding() {
    return this.assessments.onboarding();
  }

  @Get('me/attempts')
  @ApiOperation({ summary: 'This student\'s past attempts' })
  attempts(@CurrentUser() user: User) {
    return this.assessments.attempts(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'One assessment, without the answer key' })
  one(@Param('id') id: string) {
    return this.assessments.one(id);
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Submit an assessment',
    description:
      'Scores the attempt, stores it, emails the result through Resend, and awards 40 points the first time.',
  })
  submit(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: SubmitAssessmentDto,
  ) {
    return this.assessments.submit(user, id, dto.answers);
  }
}
