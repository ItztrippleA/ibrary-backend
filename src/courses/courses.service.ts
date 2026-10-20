import { Injectable } from '@nestjs/common';
import { CourseStatus, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  create(user: User, dto: CreateCourseDto) {
    return this.prisma.course.create({
      data: {
        authorId: user.id,
        title: dto.title.trim(),
        description: dto.description.trim(),
        coverUrl: dto.coverUrl,
        classLevel: dto.classLevel,
        term: dto.term,
        status: CourseStatus.PENDING,
      },
    });
  }

  mine(user: User) {
    return this.prisma.course.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  approved() {
    return this.prisma.course.findMany({
      where: { status: CourseStatus.APPROVED },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
