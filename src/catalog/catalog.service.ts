import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const TERM_NAMES = ['', '1st Term', '2nd Term', '3rd Term'];

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async terms(classLevel: ClassLevel) {
    const grouped = await this.prisma.subject.groupBy({
      by: ['term'],
      where: { classLevel },
      _count: { _all: true },
      orderBy: { term: 'asc' },
    });
    const participants = await Promise.all(
      grouped.map((row) =>
        this.prisma.subjectParticipant.count({
          where: { subject: { classLevel, term: row.term } },
        }),
      ),
    );
    return grouped.map((row, index) => ({
      term: row.term,
      name: TERM_NAMES[row.term] ?? `Term ${row.term}`,
      subjectCount: row._count._all,
      participantCount: participants[index],
    }));
  }

  async subjects(input: {
    classLevel?: ClassLevel;
    term?: number;
    q?: string;
  }) {
    const where: Prisma.SubjectWhereInput = {};
    if (input.classLevel) where.classLevel = input.classLevel;
    if (input.term) where.term = input.term;
    if (input.q) {
      where.OR = [
        { name: { contains: input.q, mode: 'insensitive' } },
        { description: { contains: input.q, mode: 'insensitive' } },
      ];
    }
    const subjects = await this.prisma.subject.findMany({
      where,
      orderBy: [{ term: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { participants: true, reviews: true } } },
    });
    return subjects.map((subject) => this.present(subject));
  }

  async subject(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        books: true,
        _count: { select: { participants: true, reviews: true } },
      },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    const rating = await this.prisma.review.aggregate({
      where: { subjectId: id },
      _avg: { rating: true },
    });
    return {
      ...this.present(subject),
      books: subject.books,
      averageRating: rating._avg.rating,
    };
  }

  async participants(subjectId: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    const people = await this.prisma.subjectParticipant.findMany({
      where: { subjectId },
      take: 12,
      orderBy: { joinedAt: 'desc' },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
    return {
      count: await this.prisma.subjectParticipant.count({ where: { subjectId } }),
      people: people.map((row) => row.user),
    };
  }

  private present(subject: {
    id: string;
    slug: string;
    name: string;
    description: string;
    coverUrl: string | null;
    durationMinutes: number;
    term: number;
    classLevel: ClassLevel;
    _count: { participants: number; reviews: number };
  }) {
    return {
      id: subject.id,
      slug: subject.slug,
      name: subject.name,
      description: subject.description,
      coverUrl: subject.coverUrl,
      durationMinutes: subject.durationMinutes,
      term: subject.term,
      termName: TERM_NAMES[subject.term] ?? `Term ${subject.term}`,
      classLevel: subject.classLevel,
      participantCount: subject._count.participants,
      reviewCount: subject._count.reviews,
    };
  }
}
