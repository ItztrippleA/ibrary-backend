import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CourseStatus,
  NotificationType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { paginate } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../storage/object-storage';
import { parseQuizCsv } from './quiz-csv';
import {
  AdjustWalletDto,
  BannerDto,
  BroadcastNotificationDto,
  CatalogAdminQuery,
  CourseAdminQuery,
  CreateBookDto,
  ImportQuizCsvDto,
  ReviewCourseDto,
  SaveQuizDto,
  UpdateUserRoleDto,
  UpsertSubjectDto,
  UserQuery,
} from './dto/admin.dto';

const person = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  classLevel: true,
  classPath: true,
  role: true,
  points: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async overview() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [
      users,
      newUsers,
      admins,
      subjects,
      books,
      courseGroups,
      assessments,
      questions,
      attempts,
      reviews,
      activeSubscriptions,
      payments,
      wallets,
      notifications,
      unreadNotifications,
      referrals,
      activities,
      progress,
      banners,
      points,
      terms,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.subject.count(),
      this.prisma.book.count(),
      this.prisma.course.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.assessment.count(),
      this.prisma.question.count(),
      this.prisma.assessmentAttempt.count(),
      this.prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amountKobo: true },
        _count: { _all: true },
      }),
      this.prisma.wallet.aggregate({
        _sum: { balanceKobo: true },
        _count: { _all: true },
      }),
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { readAt: null } }),
      this.prisma.referralRedemption.count(),
      this.prisma.activity.count({ where: { createdAt: { gte: since } } }),
      this.prisma.progress.aggregate({
        _avg: { percent: true },
        _count: { _all: true },
      }),
      this.prisma.banner.count({ where: { active: true } }),
      this.prisma.user.aggregate({ _sum: { points: true } }),
      this.prisma.subject.groupBy({ by: ['term', 'classLevel'], _count: { _all: true } }),
    ]);

    const courses = Object.fromEntries(
      courseGroups.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<CourseStatus, number>>;

    return {
      users: { total: users, newThisWeek: newUsers, admins },
      catalog: { subjects, books, terms: terms.length },
      courses: {
        pending: courses.PENDING ?? 0,
        approved: courses.APPROVED ?? 0,
        rejected: courses.REJECTED ?? 0,
        draft: courses.DRAFT ?? 0,
      },
      assessments: { quizzes: assessments, questions, attempts },
      learning: {
        progressRows: progress._count._all,
        averagePercent: Math.round(progress._avg.percent ?? 0),
        activitiesThisWeek: activities,
      },
      games: { pointsInCirculation: points._sum.points ?? 0 },
      reviews: {
        total: reviews._count._all,
        averageRating: Number((reviews._avg.rating ?? 0).toFixed(2)),
      },
      billing: {
        activeSubscriptions,
        successfulPayments: payments._count._all,
        revenueKobo: payments._sum.amountKobo ?? 0,
        walletCount: wallets._count._all,
        purseKobo: wallets._sum.balanceKobo ?? 0,
      },
      notifications: { total: notifications, unread: unreadNotifications },
      referrals,
      banners: { active: banners },
    };
  }

  async users(query: UserQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { lastName: { contains: q, mode: 'insensitive' } },
              { referralCode: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          ...person,
          referralCode: true,
          emailVerifiedAt: true,
          createdAt: true,
          wallet: { select: { balanceKobo: true } },
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
            select: { status: true, plan: { select: { name: true, code: true } } },
          },
          _count: { select: { referralsMade: true, courses: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async user(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...person,
        referralCode: true,
        emailVerifiedAt: true,
        termsAcceptedAt: true,
        createdAt: true,
        referredBy: { select: person },
        wallet: {
          include: { entries: { orderBy: { createdAt: 'desc' }, take: 12 } },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          include: { plan: true },
        },
        payments: { orderBy: { createdAt: 'desc' }, take: 12 },
        courses: { orderBy: { createdAt: 'desc' } },
        progress: {
          include: { subject: { select: { id: true, name: true, term: true, classLevel: true } } },
        },
        _count: {
          select: {
            referralsMade: true,
            attempts: true,
            activities: true,
            reviews: true,
            notifications: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setRole(id: string, dto: UpdateUserRoleDto, actorId: string) {
    if (id === actorId && dto.role !== UserRole.ADMIN) {
      throw new BadRequestException('You cannot remove your own admin role');
    }
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { role: dto.role },
        select: person,
      });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  async catalog(query: CatalogAdminQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const q = query.q?.trim();
    const where: Prisma.SubjectWhereInput = {
      ...(query.classLevel ? { classLevel: query.classLevel } : {}),
      ...(query.term ? { term: query.term } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total, byTerm] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        skip,
        take,
        orderBy: [{ classLevel: 'asc' }, { term: 'asc' }, { name: 'asc' }],
        include: {
          books: true,
          _count: { select: { progress: true, reviews: true, participants: true } },
        },
      }),
      this.prisma.subject.count({ where }),
      this.prisma.subject.groupBy({
        by: ['classLevel', 'term'],
        _count: { _all: true },
        orderBy: [{ classLevel: 'asc' }, { term: 'asc' }],
      }),
    ]);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      terms: byTerm.map((row) => ({
        classLevel: row.classLevel,
        term: row.term,
        subjects: row._count._all,
      })),
    };
  }

  async createSubject(dto: UpsertSubjectDto) {
    try {
      return await this.prisma.subject.create({ data: dto });
    } catch (error) {
      this.rethrowSubjectConflict(error);
    }
  }

  async updateSubject(id: string, dto: UpsertSubjectDto) {
    try {
      return await this.prisma.subject.update({ where: { id }, data: dto });
    } catch (error) {
      this.rethrowSubjectConflict(error);
      throw new NotFoundException('Subject not found');
    }
  }

  async addBook(subjectId: string, dto: CreateBookDto) {
    const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundException('Subject not found');
    return this.prisma.book.create({ data: { ...dto, subjectId } });
  }

  async removeBook(id: string) {
    try {
      await this.prisma.book.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('Book not found');
    }
  }

  async courses(query: CourseAdminQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const where: Prisma.CourseWhereInput = query.status ? { status: query.status } : {};
    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: person } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async reviewCourse(id: string, dto: ReviewCourseDto) {
    try {
      return await this.prisma.course.update({
        where: { id },
        data: { status: dto.status, reviewNote: dto.reviewNote },
        include: { author: { select: person } },
      });
    } catch {
      throw new NotFoundException('Course not found');
    }
  }

  async assessments(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [items, total] = await Promise.all([
      this.prisma.assessment.findMany({
        skip,
        take,
        orderBy: { title: 'asc' },
        include: {
          _count: { select: { questions: true, attempts: true } },
        },
      }),
      this.prisma.assessment.count(),
    ]);
    const scored = await this.prisma.assessmentAttempt.groupBy({
      by: ['assessmentId'],
      _avg: { score: true, total: true },
    });
    const averages = new Map(scored.map((row) => [row.assessmentId, row]));
    return {
      items: items.map((item) => {
        const avg = averages.get(item.id);
        return {
          ...item,
          averageScore: avg?._avg.score ?? null,
          averageTotal: avg?._avg.total ?? null,
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async assessment(id: string) {
    const item = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
        attempts: {
          orderBy: { completedAt: 'desc' },
          take: 25,
          include: { user: { select: person } },
        },
        _count: { select: { attempts: true, questions: true } },
      },
    });
    if (!item) throw new NotFoundException('Assessment not found');
    return item;
  }

  async createQuiz(dto: SaveQuizDto) {
    const questions = this.quizQuestions(dto);
    const slug = await this.uniqueQuizSlug(dto.title);
    return this.prisma.assessment.create({
      data: {
        slug,
        title: dto.title.trim(),
        description: dto.description.trim(),
        classLevel: dto.classLevel ?? null,
        onboarding: false,
        questions: { create: questions },
      },
    });
  }

  async updateQuiz(id: string, dto: SaveQuizDto) {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assessment not found');
    const questions = this.quizQuestions(dto);
    return this.prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { assessmentId: id } });
      return tx.assessment.update({
        where: { id },
        data: {
          title: dto.title.trim(),
          description: dto.description.trim(),
          classLevel: dto.classLevel ?? null,
          questions: { create: questions },
        },
        include: {
          questions: { orderBy: { order: 'asc' } },
        },
      });
    });
  }

  private quizQuestions(dto: SaveQuizDto) {
    return dto.questions.map((question, index) => {
      const options = question.options.map((option) => option.trim());
      if (options.some((option) => !option)) {
        throw new BadRequestException(`Question ${index + 1} has an empty option.`);
      }
      if (question.correctIndex >= options.length) {
        throw new BadRequestException(`Question ${index + 1} has no matching correct option.`);
      }
      return {
        prompt: question.prompt.trim(),
        options,
        correctIndex: question.correctIndex,
        order: index + 1,
      };
    });
  }

  private async uniqueQuizSlug(title: string) {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'quiz';
    let slug = base;
    for (let n = 2; await this.prisma.assessment.findUnique({ where: { slug } }); n += 1) {
      slug = `${base}-${n}`;
      if (n > 40) throw new BadRequestException('Choose a different title.');
    }
    return slug;
  }

  async importQuizzes(dto: ImportQuizCsvDto) {
    let parsed: ReturnType<typeof parseQuizCsv>;
    try {
      parsed = parseQuizCsv(dto.csv);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Could not read the CSV');
    }
    if (!parsed.quizzes.length) {
      throw new BadRequestException(parsed.skipped[0]?.reason ?? 'The CSV has no quiz rows.');
    }

    const subject = dto.subject?.trim();
    const ready = parsed.quizzes.flatMap((quiz) => {
      const classLevel = dto.classLevel ?? quiz.classLevel;
      return classLevel ? [{ ...quiz, classLevel }] : [];
    });
    const missingClass = parsed.quizzes.length - ready.length;
    if (!ready.length) {
      throw new BadRequestException('Choose a class. The file does not say which class these quizzes belong to.');
    }

    const known = new Set(
      (
        await this.prisma.assessment.findMany({
          where: { slug: { in: ready.map((quiz) => quiz.slug) } },
          select: { slug: true },
        })
      ).map((quiz) => quiz.slug),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const quiz of ready) {
        const years = quiz.questions.flatMap((question) => (question.year == null ? [] : [question.year]));
        const earliest = years.length ? Math.min(...years) : null;
        const latest = years.length ? Math.max(...years) : null;
        const yearLabel =
          earliest == null ? '' : earliest === latest ? `WAEC ${earliest}` : `WAEC ${earliest}–${latest}`;
        const description = [subject, quiz.theme, yearLabel].filter(Boolean).join(' · ') || quiz.title;
        const saved = await tx.assessment.upsert({
          where: { slug: quiz.slug },
          create: {
            slug: quiz.slug,
            title: quiz.title,
            description,
            classLevel: quiz.classLevel,
            onboarding: false,
          },
          update: {
            title: quiz.title,
            description,
            classLevel: quiz.classLevel,
          },
        });
        await tx.question.deleteMany({ where: { assessmentId: saved.id } });
        await tx.question.createMany({
          data: quiz.questions.map((question, index) => ({
            assessmentId: saved.id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            order: index + 1,
          })),
        });
      }
    });

    return {
      quizzes: ready.length,
      created: ready.filter((quiz) => !known.has(quiz.slug)).length,
      updated: ready.filter((quiz) => known.has(quiz.slug)).length,
      questions: ready.reduce((sum, quiz) => sum + quiz.questions.length, 0),
      skipped: parsed.skipped.slice(0, 20),
      skippedCount: parsed.skipped.length + missingClass,
    };
  }

  async learning(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [activity, progress, activityTotal, progressTotal] = await Promise.all([
      this.prisma.activity.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: person } },
      }),
      this.prisma.progress.findMany({
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: person },
          subject: { select: { id: true, name: true, term: true, classLevel: true } },
        },
      }),
      this.prisma.activity.count(),
      this.prisma.progress.count(),
    ]);
    return {
      activity: { items: activity, total: activityTotal },
      progress: { items: progress, total: progressTotal },
      page: query.page,
      limit: query.limit,
    };
  }

  async games() {
    const [leaderboard, ledger, badges, incentives, reasons] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { points: 'desc' },
        take: 25,
        select: {
          ...person,
          badges: { select: { badge: { select: { name: true, slug: true } } } },
        },
      }),
      this.prisma.pointLedger.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { user: { select: person } },
      }),
      this.prisma.badge.findMany({
        include: { _count: { select: { users: true } } },
        orderBy: { pointsRequired: 'asc' },
      }),
      this.prisma.incentive.findMany({ orderBy: { pointsRequired: 'asc' } }),
      this.prisma.pointLedger.groupBy({
        by: ['reason'],
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 8,
      }),
    ]);
    return {
      leaderboard: leaderboard.map((row, index) => ({ rank: index + 1, ...row })),
      ledger,
      badges,
      incentives,
      reasons: reasons.map((row) => ({
        reason: row.reason,
        points: row._sum.amount ?? 0,
        entries: row._count._all,
      })),
    };
  }

  async reviews(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [items, total, summary] = await Promise.all([
      this.prisma.review.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: person },
          subject: { select: { id: true, name: true, classLevel: true, term: true } },
        },
      }),
      this.prisma.review.count(),
      this.prisma.review.aggregate({ _avg: { rating: true } }),
    ]);
    return {
      items,
      total,
      averageRating: Number((summary._avg.rating ?? 0).toFixed(2)),
      page: query.page,
      limit: query.limit,
    };
  }

  async removeReview(id: string) {
    try {
      await this.prisma.review.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('Review not found');
    }
  }

  async notifications(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [items, total, byType] = await Promise.all([
      this.prisma.notification.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: person } },
      }),
      this.prisma.notification.count(),
      this.prisma.notification.groupBy({
        by: ['type'],
        _count: { _all: true },
      }),
    ]);
    return {
      items,
      total,
      byType: byType.map((row) => ({ type: row.type, count: row._count._all })),
      page: query.page,
      limit: query.limit,
    };
  }

  async broadcast(dto: BroadcastNotificationDto) {
    const users = await this.prisma.user.findMany({
      where: { inAppNotifications: true },
      select: { id: true },
    });
    if (!users.length) return { sent: 0 };
    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: dto.type ?? NotificationType.GENERAL,
        title: dto.title,
        body: dto.body,
      })),
    });
    return { sent: users.length };
  }

  banners() {
    return this.prisma.banner.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async uploadBannerImage(file?: { mimetype: string; size: number; buffer: Buffer }) {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image file.');
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const extension = extensions[file.mimetype];
    if (!extension) throw new BadRequestException('Use a JPEG, PNG, WebP, or GIF.');
    if (file.size > 5 * 1024 * 1024) throw new BadRequestException('Images must be 5 MB or smaller.');
    return this.storage.put({
      folder: 'banners',
      filename: `${crypto.randomUUID()}.${extension}`,
      contentType: file.mimetype,
      body: file.buffer,
    });
  }

  createBanner(dto: BannerDto) {
    return this.prisma.banner.create({ data: this.bannerData(dto) });
  }

  async updateBanner(id: string, dto: BannerDto) {
    try {
      return await this.prisma.banner.update({
        where: { id },
        data: this.bannerData(dto),
      });
    } catch {
      throw new NotFoundException('Banner not found');
    }
  }

  async removeBanner(id: string) {
    try {
      await this.prisma.banner.delete({ where: { id } });
      return { ok: true };
    } catch {
      throw new NotFoundException('Banner not found');
    }
  }

  async billing(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [plans, subscriptions, payments, wallets, subscriptionTotal, paymentTotal] =
      await Promise.all([
        this.prisma.plan.findMany({
          orderBy: { amountKobo: 'asc' },
          include: { _count: { select: { subscriptions: true } } },
        }),
        this.prisma.subscription.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: person }, plan: true },
        }),
        this.prisma.payment.findMany({
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: person } },
        }),
        this.prisma.wallet.findMany({
          orderBy: { balanceKobo: 'desc' },
          take: 25,
          include: {
            user: { select: person },
            entries: { orderBy: { createdAt: 'desc' }, take: 3 },
          },
        }),
        this.prisma.subscription.count(),
        this.prisma.payment.count(),
      ]);
    return {
      plans,
      subscriptions: { items: subscriptions, total: subscriptionTotal },
      payments: { items: payments, total: paymentTotal },
      wallets,
      page: query.page,
      limit: query.limit,
    };
  }

  async adjustWallet(userId: string, dto: AdjustWalletDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.amountKobo === 0) {
      throw new BadRequestException('Amount cannot be zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.wallet.upsert({
        where: { userId },
        create: { userId, balanceKobo: 0 },
        update: {},
      });
      const next = existing.balanceKobo + dto.amountKobo;
      if (next < 0) {
        throw new BadRequestException('Purse balance cannot go below zero');
      }
      const wallet = await tx.wallet.update({
        where: { id: existing.id },
        data: {
          balanceKobo: next,
          entries: { create: { amountKobo: dto.amountKobo, reason: dto.reason } },
        },
        include: { entries: { orderBy: { createdAt: 'desc' }, take: 8 }, user: { select: person } },
      });
      return wallet;
    });
  }

  async referrals(query: { page: number; limit: number }) {
    const { skip, take } = paginate(query.page, query.limit);
    const [items, total, top] = await Promise.all([
      this.prisma.referralRedemption.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          referrer: { select: person },
          referee: { select: { ...person, createdAt: true } },
        },
      }),
      this.prisma.referralRedemption.count(),
      this.prisma.user.findMany({
        where: { referralsMade: { some: {} } },
        orderBy: { referralsMade: { _count: 'desc' } },
        take: 10,
        select: {
          ...person,
          referralCode: true,
          _count: { select: { referralsMade: true } },
        },
      }),
    ]);
    return { items, total, top, page: query.page, limit: query.limit };
  }

  private rethrowSubjectConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A subject with this slug already exists for that class and term',
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new NotFoundException('Subject not found');
    }
    throw error;
  }

  private optionalDate(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Use a valid start or end date');
    }
    return date;
  }

  private bannerData(dto: BannerDto): Prisma.BannerCreateInput {
    return {
      title: dto.title,
      body: dto.body ?? '',
      imageUrl: dto.imageUrl,
      linkUrl: dto.linkUrl,
      placement: dto.placement ?? 'home',
      active: dto.active ?? true,
      startsAt: this.optionalDate(dto.startsAt),
      endsAt: this.optionalDate(dto.endsAt),
    };
  }
}
