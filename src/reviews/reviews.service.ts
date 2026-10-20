import { Injectable, NotFoundException } from '@nestjs/common';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async list(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    const [items, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: { subjectId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      }),
      this.prisma.review.aggregate({
        where: { subjectId },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);
    return {
      average: aggregate._avg.rating,
      count: aggregate._count._all,
      items,
    };
  }

  async create(userId: string, subjectId: string, rating: number, body: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    const existing = await this.prisma.review.findUnique({
      where: { userId_subjectId: { userId, subjectId } },
    });
    const review = await this.prisma.review.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      create: { userId, subjectId, rating, body },
      update: { rating, body },
    });
    if (!existing) {
      await this.gamification.awardPoints(userId, 10, `Reviewed ${subject.name}`);
    }
    return review;
  }
}
