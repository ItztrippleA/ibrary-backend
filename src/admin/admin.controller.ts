import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole, type User } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PaginationQuery } from '../common/pagination';
import { AdminService } from './admin.service';
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

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform counts for the admin home' })
  overview() {
    return this.admin.overview();
  }

  @Get('users')
  @ApiOperation({ summary: 'Search students and admins' })
  users(@Query() query: UserQuery) {
    return this.admin.users(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'User profile, purse, subscription, courses, and progress' })
  user(@Param('id') id: string) {
    return this.admin.user(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Promote or demote a user' })
  setRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() actor: User,
  ) {
    return this.admin.setRole(id, dto, actor.id);
  }

  @Get('catalog')
  @ApiOperation({ summary: 'Subjects, books, and term coverage' })
  catalog(@Query() query: CatalogAdminQuery) {
    return this.admin.catalog(query);
  }

  @Post('catalog/subjects')
  @ApiOperation({ summary: 'Add a subject to a class term' })
  createSubject(@Body() dto: UpsertSubjectDto) {
    return this.admin.createSubject(dto);
  }

  @Patch('catalog/subjects/:id')
  @ApiOperation({ summary: 'Update a catalogue subject' })
  updateSubject(@Param('id') id: string, @Body() dto: UpsertSubjectDto) {
    return this.admin.updateSubject(id, dto);
  }

  @Post('catalog/subjects/:id/books')
  @ApiOperation({ summary: 'Attach a book to a subject' })
  addBook(@Param('id') id: string, @Body() dto: CreateBookDto) {
    return this.admin.addBook(id, dto);
  }

  @Delete('catalog/books/:id')
  @ApiOperation({ summary: 'Remove a book' })
  removeBook(@Param('id') id: string) {
    return this.admin.removeBook(id);
  }

  @Get('courses')
  @ApiOperation({ summary: 'User-uploaded courses awaiting moderation' })
  courses(@Query() query: CourseAdminQuery) {
    return this.admin.courses(query);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Approve, reject, or return a course to draft' })
  reviewCourse(@Param('id') id: string, @Body() dto: ReviewCourseDto) {
    return this.admin.reviewCourse(id, dto);
  }

  @Get('assessments')
  @ApiOperation({ summary: 'Quizzes and assessments with attempt averages' })
  assessments(@Query() query: PaginationQuery) {
    return this.admin.assessments(query);
  }

  @Post('assessments')
  @ApiOperation({ summary: 'Create a quiz and its questions' })
  createQuiz(@Body() dto: SaveQuizDto) {
    return this.admin.createQuiz(dto);
  }

  @Post('assessments/import')
  @ApiOperation({ summary: 'Create or replace quizzes from a topic CSV' })
  importQuizzes(@Body() dto: ImportQuizCsvDto) {
    return this.admin.importQuizzes(dto);
  }

  @Patch('assessments/:id')
  @ApiOperation({ summary: 'Update a quiz and replace its questions' })
  updateQuiz(@Param('id') id: string, @Body() dto: SaveQuizDto) {
    return this.admin.updateQuiz(id, dto);
  }

  @Get('assessments/:id')
  @ApiOperation({ summary: 'Quiz questions and recent attempts' })
  assessment(@Param('id') id: string) {
    return this.admin.assessment(id);
  }

  @Get('learning')
  @ApiOperation({ summary: 'Activity feed and subject progress' })
  learning(@Query() query: PaginationQuery) {
    return this.admin.learning(query);
  }

  @Get('games')
  @ApiOperation({ summary: 'Leaderboard, point ledger, badges, and incentives' })
  games() {
    return this.admin.games();
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Subject reviews' })
  reviews(@Query() query: PaginationQuery) {
    return this.admin.reviews(query);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Remove a review' })
  removeReview(@Param('id') id: string) {
    return this.admin.removeReview(id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notification inbox across users' })
  notifications(@Query() query: PaginationQuery) {
    return this.admin.notifications(query);
  }

  @Post('notifications')
  @ApiOperation({ summary: 'Send an in-app notice to every user who allows them' })
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.admin.broadcast(dto);
  }

  @Get('banners')
  @ApiOperation({ summary: 'Ad and announcement banners' })
  banners() {
    return this.admin.banners();
  }

  @Post('banners/image')
  @ApiOperation({ summary: 'Upload a banner image. Stored locally until S3 is connected.' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
    return this.admin.uploadBannerImage(file);
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a banner' })
  createBanner(@Body() dto: BannerDto) {
    return this.admin.createBanner(dto);
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: 'Replace a banner' })
  updateBanner(@Param('id') id: string, @Body() dto: BannerDto) {
    return this.admin.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete a banner' })
  removeBanner(@Param('id') id: string) {
    return this.admin.removeBanner(id);
  }

  @Get('billing')
  @ApiOperation({ summary: 'Plans, subscriptions, payments, and purse balances' })
  billing(@Query() query: PaginationQuery) {
    return this.admin.billing(query);
  }

  @Post('wallets/:userId/adjust')
  @ApiOperation({ summary: 'Credit or debit a user purse, in kobo' })
  adjustWallet(@Param('userId') userId: string, @Body() dto: AdjustWalletDto) {
    return this.admin.adjustWallet(userId, dto);
  }

  @Get('referrals')
  @ApiOperation({ summary: 'Referral redemptions and top referrers' })
  referrals(@Query() query: PaginationQuery) {
    return this.admin.referrals(query);
  }
}
