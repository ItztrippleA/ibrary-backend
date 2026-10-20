import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { NotificationType, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { readEnv } from '../config/env';
import { receiptEmail } from '../notifications/email.templates';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { paystackSignature, signaturesMatch } from './paystack.signature';

type InitializeInput = {
  email: string;
  amountKobo: number;
  reference: string;
  metadata: Record<string, string>;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly env = readEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async initialize(input: InitializeInput) {
    if (!this.env.paystackSecretKey) {
      throw new ServiceUnavailableException(
        'Paystack is not configured. Set PAYSTACK_SECRET_KEY.',
      );
    }
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        reference: input.reference,
        currency: 'NGN',
        callback_url: `${this.env.appUrl}/api/v1/payments/paystack/callback`,
        metadata: input.metadata,
      }),
    });
    const payload = (await response.json()) as {
      status: boolean;
      message: string;
      data?: { authorization_url: string; reference: string };
    };
    if (!response.ok || !payload.status || !payload.data) {
      throw new ServiceUnavailableException(payload.message || 'Paystack initialize failed');
    }
    return {
      authorizationUrl: payload.data.authorization_url,
      reference: payload.data.reference,
      publicKey: this.env.paystackPublicKey,
    };
  }

  async verify(reference: string) {
    if (!this.env.paystackSecretKey) {
      throw new ServiceUnavailableException('Paystack is not configured.');
    }
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${this.env.paystackSecretKey}` } },
    );
    const payload = (await response.json()) as {
      status: boolean;
      data?: {
        status: string;
        reference: string;
        channel?: string;
        paid_at?: string;
      };
    };
    if (!response.ok || !payload.status || !payload.data) {
      throw new NotFoundException('Paystack could not find that reference');
    }
    if (payload.data.status === 'success') {
      await this.markPaid(payload.data.reference, payload.data.channel ?? null);
    }
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    return payment;
  }

  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!this.env.paystackSecretKey) {
      throw new ServiceUnavailableException('Paystack is not configured.');
    }
    if (!rawBody) {
      throw new UnauthorizedException('Missing raw webhook body');
    }
    const expected = paystackSignature(this.env.paystackSecretKey, rawBody);
    if (!signaturesMatch(expected, signature)) {
      throw new UnauthorizedException('Invalid Paystack signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: { reference?: string; channel?: string; status?: string };
    };
    if (event.event === 'charge.success' && event.data?.reference) {
      await this.markPaid(event.data.reference, event.data.channel ?? null);
    }
    return { received: true };
  }

  private async markPaid(reference: string, channel: string | null) {
    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: { user: true, subscription: { include: { plan: true } } },
    });
    if (!payment || payment.status === PaymentStatus.SUCCESS || !payment.subscription) {
      return;
    }
    const plan = payment.subscription.plan;
    const periodEnd = addMonths(new Date(), plan.intervalMonths);

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS, channel, paidAt: new Date() },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscription.id },
        data: { status: SubscriptionStatus.ACTIVE, periodEnd },
      }),
      this.prisma.subscription.updateMany({
        where: {
          userId: payment.userId,
          id: { not: payment.subscription.id },
          status: SubscriptionStatus.ACTIVE,
        },
        data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
      }),
    ]);

    const amount = naira(payment.amountKobo);
    const mail = receiptEmail(payment.user.firstName, plan.name, amount);
    await this.notifications.notify({
      user: payment.user,
      type: NotificationType.SUBSCRIPTION,
      title: 'Subscription active',
      body: `You subscribed to ${plan.name}. Check your profile tab to view it.`,
      email: { subject: mail.subject, html: mail.html },
    });
    this.logger.log(`Payment ${reference} marked paid`);
  }
}

export function naira(kobo: number): string {
  return (kobo / 100).toLocaleString('en-NG', {
    style: 'currency',
    currency: 'NGN',
  });
}

export function addMonths(from: Date, months: number): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function chargeKobo(amountKobo: number, promoPercent: number, extraPercent: number) {
  const afterPromo = Math.round((amountKobo * (100 - promoPercent)) / 100);
  return Math.round((afterPromo * (100 - extraPercent)) / 100);
}
