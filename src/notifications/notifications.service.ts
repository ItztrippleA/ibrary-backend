import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, User } from '@prisma/client';
import { Resend } from 'resend';
import { readEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

type NotifyInput = {
  user: Pick<
    User,
    | 'id'
    | 'email'
    | 'firstName'
    | 'emailNotifications'
    | 'inAppNotifications'
    | 'assessmentEmails'
    | 'billingEmails'
  >;
  type: NotificationType;
  title: string;
  body: string;
  email?: { subject: string; html: string };
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly env = readEnv();
  private readonly resend = this.env.resendApiKey
    ? new Resend(this.env.resendApiKey)
    : null;

  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput) {
    const notification = input.user.inAppNotifications
      ? await this.prisma.notification.create({
          data: {
            userId: input.user.id,
            type: input.type,
            title: input.title,
            body: input.body,
          },
        })
      : null;

    const allowEmail = this.emailAllowed(input.user, input.type);
    if (!input.email || !allowEmail) {
      return notification;
    }

    const sent = await this.sendEmail(
      input.user.email,
      input.email.subject,
      input.email.html,
    );
    if (sent && notification) {
      return this.prisma.notification.update({
        where: { id: notification.id },
        data: { emailSentAt: new Date() },
      });
    }
    return notification;
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.resend) {
      this.logger.log(`Email skipped (RESEND_API_KEY unset) to ${to}: ${subject}`);
      return false;
    }
    const result = await this.resend.emails.send({
      from: this.env.emailFrom,
      to,
      subject,
      html,
    });
    if (result.error) {
      this.logger.error(`Resend failed for ${to}: ${result.error.message}`);
      return false;
    }
    return true;
  }

  list(userId: string, skip: number, take: number) {
    return this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
  }

  markRead(userId: string, id: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private emailAllowed(
    user: NotifyInput['user'],
    type: NotificationType,
  ): boolean {
    if (!user.emailNotifications) return false;
    if (type === NotificationType.ASSESSMENT_RESULT && !user.assessmentEmails) {
      return false;
    }
    if (type === NotificationType.SUBSCRIPTION && !user.billingEmails) {
      return false;
    }
    return true;
  }
}
