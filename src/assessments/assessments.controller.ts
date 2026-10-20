import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
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
