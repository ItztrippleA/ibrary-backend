import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { paginate, PaginationQuery } from '../common/pagination';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List in-app notifications',
    description:
      'Bell inbox. Email delivery is handled by Resend and recorded on emailSentAt when a message was also emailed.',
  })
  @ApiOkResponse({ description: 'Newest notifications first' })
  async list(@CurrentUser() user: User, @Query() query: PaginationQuery) {
    const { skip, take } = paginate(query.page, query.limit);
    const [items, total] = await this.notifications.list(user.id, skip, take);
    return { items, total, page: query.page, limit: query.limit };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async read(@CurrentUser() user: User, @Param('id') id: string) {
    await this.notifications.markRead(user.id, id);
    return { ok: true };
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark every notification as read' })
  async readAll(@CurrentUser() user: User) {
    const result = await this.notifications.markAllRead(user.id);
    return { updated: result.count };
  }

  @Get('preferences')
  @ApiOperation({
    summary: 'Notification preferences',
    description:
      'Controls the in-app inbox and which Resend emails the student still receives.',
  })
  preferences(@CurrentUser() user: User) {
    return this.prefs(user);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @CurrentUser() user: User,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
    });
    return this.prefs(updated);
  }

  private prefs(user: User) {
    return {
      emailNotifications: user.emailNotifications,
      inAppNotifications: user.inAppNotifications,
      assessmentEmails: user.assessmentEmails,
      billingEmails: user.billingEmails,
    };
  }
}
