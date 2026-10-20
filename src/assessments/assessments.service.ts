import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassLevel, NotificationType, Prisma, User } from '@prisma/client';
import { GamificationService } from '../gamification/gamification.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentAnswerDto } from './dto/submit-assessment.dto';

const CLASS_LEVELS = new Set<string>(Object.values(ClassLevel));

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly notifications: NotificationsService,
  ) {}

  list(user: User) {
    const or: Prisma.AssessmentWhereInput[] = [{ onboarding: true }, { classLevel: null }];
    if (user.classLevel) or.push({ classLevel: user.classLevel });
    return this.prisma.assessment.findMany({
      where: { OR: or },
      orderBy: [{ onboarding: 'desc' }, { title: 'asc' }],
      include: { _count: { select: { questions: true } } },
    });
  }

  async onboarding() {
    const assessment = await this.prisma.assessment.findFirst({
      where: { onboarding: true },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment) throw new NotFoundException('Onboarding assessment is not seeded');
    return this.withoutAnswers(assessment);
  }

  async one(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: { questions: { orderBy: { order: 'asc' } } },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    return this.withoutAnswers(assessment);
  }

  attempts(userId: string) {
    return this.prisma.assessmentAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: { assessment: { select: { id: true, title: true, slug: true } } },
    });
  }

  async submit(user: User, assessmentId: string, answers: AssessmentAnswerDto[]) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: { questions: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (answers.length !== assessment.questions.length) {
      throw new BadRequestException('Answer every question');
    }

    const byId = new Map(assessment.questions.map((question) => [question.id, question]));
    let score = 0;
    const graded = answers.map((answer) => {
      const question = byId.get(answer.questionId);
      if (!question) throw new BadRequestException('Unknown question');
      if (answer.selected >= question.options.length) {
        throw new BadRequestException('Selected option is out of range');
      }
      const correct =
        question.correctIndex < 0 || answer.selected === question.correctIndex;
      if (correct) score += 1;
      return { question, selected: answer.selected, correct };
    });

    const prior = await this.prisma.assessmentAttempt.count({
      where: { userId: user.id, assessmentId },
    });

    const attempt = await this.prisma.assessmentAttempt.create({
      data: {
        userId: user.id,
        assessmentId,
        score,
        total: assessment.questions.length,
        answers: {
          create: graded.map((row) => ({
            questionId: row.question.id,
            selected: row.selected,
            correct: row.correct,
          })),
        },
      },
    });

    await this.applyOnboardingAnswers(user.id, graded);

    if (prior === 0) {
      await this.gamification.awardPoints(
        user.id,
        40,
        `Completed ${assessment.title}`,
      );
    }

    await this.prisma.activity.create({
      data: {
        userId: user.id,
        title: assessment.title,
        detail: `Scored ${score} of ${assessment.questions.length}`,
      },
    });

    await this.notifications.notify({
      user,
      type: NotificationType.ASSESSMENT_RESULT,
      title: 'Assessment result',
      body: `You scored ${score} of ${assessment.questions.length} on ${assessment.title}.`,
      email: {
        subject: `Your ${assessment.title} result`,
        html: `<p>Hi ${user.firstName}, you scored ${score} of ${assessment.questions.length}.</p>`,
      },
    });

    return {
      attemptId: attempt.id,
      score,
      total: assessment.questions.length,
      passed: score / assessment.questions.length >= 0.5,
    };
  }

  private async applyOnboardingAnswers(
    userId: string,
    graded: { question: { prompt: string; options: string[] }; selected: number }[],
  ) {
    const data: { classLevel?: ClassLevel; classPath?: string } = {};
    for (const row of graded) {
      const choice = row.question.options[row.selected];
      if (row.question.options.every((option) => CLASS_LEVELS.has(option))) {
        data.classLevel = choice as ClassLevel;
      }
      if (/class path/i.test(row.question.prompt)) {
        data.classPath = choice;
      }
    }
    if (data.classLevel || data.classPath) {
      await this.prisma.user.update({ where: { id: userId }, data });
    }
  }

  private withoutAnswers<T extends { questions: { correctIndex: number }[] }>(
    assessment: T,
  ) {
    return {
      ...assessment,
      questions: assessment.questions.map(({ correctIndex: _hidden, ...question }) => question),
    };
  }
}
