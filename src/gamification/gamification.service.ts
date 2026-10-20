import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async awardPoints(userId: string, amount: number, reason: string) {
    const user = await this.prisma.$transaction(async (tx) => {
      await tx.pointLedger.create({ data: { userId, amount, reason } });
      return tx.user.update({
        where: { id: userId },
        data: { points: { increment: amount } },
      });
    });
    await this.awardBadges(user.id, user.points);
    return user.points;
  }

  async summary(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const rank =
      (await this.prisma.user.count({ where: { points: { gt: user.points } } })) +
      1;
    const total = await this.prisma.user.count();
    return { points: user.points, rank, total };
  }

  async leaderboard(userId: string) {
    const [board, me] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
        take: 50,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          classLevel: true,
          points: true,
        },
      }),
      this.summary(userId),
    ]);
    return {
      me,
      leaders: board.map((entry, index) => ({ rank: index + 1, ...entry })),
    };
  }

  badges(userId: string) {
    return this.prisma.badge.findMany({
      orderBy: { pointsRequired: 'asc' },
      include: {
        users: { where: { userId }, select: { awardedAt: true } },
      },
    });
  }

  incentives() {
    return this.prisma.incentive.findMany({
      orderBy: { pointsRequired: 'asc' },
    });
  }

  private async awardBadges(userId: string, points: number) {
    const earned = await this.prisma.badge.findMany({
      where: {
        pointsRequired: { lte: points },
        users: { none: { userId } },
      },
    });
    if (earned.length === 0) return;
    await this.prisma.userBadge.createMany({
      data: earned.map((badge) => ({ userId, badgeId: badge.id })),
      skipDuplicates: true,
    });
  }
}
