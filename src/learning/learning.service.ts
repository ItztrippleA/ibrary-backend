import { Injectable, NotFoundException } from '@nestjs/common';
import { FavouriteTarget, User } from '@prisma/client';
import { CatalogService } from '../catalog/catalog.service';
import { GamificationService } from '../gamification/gamification.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly gamification: GamificationService,
  ) {}

  async home(user: User) {
    const board = await this.gamification.summary(user.id);
    const classLevel = user.classLevel;
    const [terms, subjects, books, activity] = await Promise.all([
      classLevel ? this.catalog.terms(classLevel) : Promise.resolve([]),
      classLevel
        ? this.catalog.subjects({ classLevel })
        : Promise.resolve([]),
      classLevel
        ? this.prisma.book.findMany({
            where: { subject: { classLevel } },
            take: 8,
            include: { subject: { select: { id: true, name: true } } },
          })
        : Promise.resolve([]),
      this.prisma.activity.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return {
      greeting: `Hi, ${user.firstName.toUpperCase()}`,
      welcome: 'Welcome to iBrary',
      classLevel,
      classPath: user.classPath,
      needsClassLevel: !classLevel,
      points: board.points,
      leaderboard: { rank: board.rank, total: board.total },
      terms,
      subjects: subjects.slice(0, 8),
      books,
      activity,
    };
  }

  activity(userId: string) {
    return this.prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async updateProgress(userId: string, subjectId: string, percent: number) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const progress = await this.prisma.progress.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      create: { userId, subjectId, percent },
      update: { percent },
    });
    await this.prisma.subjectParticipant.upsert({
      where: { userId_subjectId: { userId, subjectId } },
      create: { userId, subjectId },
      update: {},
    });
    await this.prisma.activity.create({
      data: {
        userId,
        title: subject.name,
        detail: `Progress updated to ${percent}%`,
      },
    });
    if (percent === 100) {
      await this.gamification.awardPoints(userId, 25, `Finished ${subject.name}`);
    }
    return progress;
  }

  async favourites(userId: string) {
    const rows = await this.prisma.favourite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const subjectIds = rows
      .filter((row) => row.targetType === FavouriteTarget.SUBJECT)
      .map((row) => row.targetId);
    const bookIds = rows
      .filter((row) => row.targetType === FavouriteTarget.BOOK)
      .map((row) => row.targetId);
    const [subjects, books] = await Promise.all([
      this.prisma.subject.findMany({ where: { id: { in: subjectIds } } }),
      this.prisma.book.findMany({ where: { id: { in: bookIds } } }),
    ]);
    return rows.map((row) => ({
      ...row,
      subject: subjects.find((subject) => subject.id === row.targetId) ?? null,
      book: books.find((book) => book.id === row.targetId) ?? null,
    }));
  }

  async addFavourite(userId: string, targetType: FavouriteTarget, targetId: string) {
    if (targetType === FavouriteTarget.SUBJECT) {
      const subject = await this.prisma.subject.findUnique({ where: { id: targetId } });
      if (!subject) throw new NotFoundException('Subject not found');
    } else {
      const book = await this.prisma.book.findUnique({ where: { id: targetId } });
      if (!book) throw new NotFoundException('Book not found');
    }
    return this.prisma.favourite.upsert({
      where: {
        userId_targetType_targetId: { userId, targetType, targetId },
      },
      create: { userId, targetType, targetId },
      update: {},
    });
  }

  removeFavourite(userId: string, id: string) {
    return this.prisma.favourite.deleteMany({ where: { id, userId } });
  }
}
