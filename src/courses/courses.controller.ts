import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser, Public } from '../common/decorators';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

@ApiTags('courses')
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Approved courses uploaded by users' })
  approved() {
    return this.courses.approved();
  }

  @ApiBearerAuth()
  @Get('mine')
  @ApiOperation({ summary: 'Courses the signed-in user has uploaded' })
  mine(@CurrentUser() user: User) {
    return this.courses.mine(user);
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({
    summary: 'Upload a course',
    description: 'The course stays pending until an admin approves it.',
  })
  create(@CurrentUser() user: User, @Body() dto: CreateCourseDto) {
    return this.courses.create(user, dto);
  }
}
