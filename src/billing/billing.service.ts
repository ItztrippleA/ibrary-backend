import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, SubscriptionStatus, User } from '@prisma/client';
import { paymentReference } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { chargeKobo, naira } from '../payments/payments.service';
import { PaymentsService } from '../payments/payments.service';

const REFERRAL_DISCOUNT = 10;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async plans(userId: string) {
    const [plans, extra] = await Promise.all([
      this.prisma.plan.findMany({ where: { active: true }, orderBy: { amountKobo: 'asc' } }),
      this.referralDiscount(userId),
    ]);
    return plans.map((plan) => {
      const amount = chargeKobo(plan.amountKobo, plan.promoPercent, extra);
      return {
        ...plan,
        listPrice: naira(plan.amountKobo),
        chargeKobo: amount,
        chargePrice: naira(amount),
        referralDiscountPercent: extra,
      };
    });
  }

  async current(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) return { active: false, subscription: null };
    const expired =
      subscription.periodEnd !== null && subscription.periodEnd < new Date();
    if (expired) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      return { active: false, subscription: { ...subscription, status: SubscriptionStatus.EXPIRED } };
    }
    return { active: true, subscription };
  }

  receipts(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId, status: PaymentStatus.SUCCESS },
      orderBy: { paidAt: 'desc' },
      include: { subscription: { include: { plan: true } } },
    });
  }

  subscribe(user: User, planCode: string) {
    return this.startCheckout(user, planCode, 'subscribe');
  }

  switchPlan(user: User, planCode: string) {
    return this.startCheckout(user, planCode, 'switch');
  }

  async cancel(userId: string) {
    const current = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
    });
    if (!current) throw new NotFoundException('No active subscription');
    const updated = await this.prisma.subscription.update({
      where: { id: current.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: new Date() },
    });
    return {
      subscription: updated,
      message:
        'Membership cancelled. Premium classes are no longer included on this account.',
    };
  }

  private async startCheckout(user: User, planCode: string, purpose: string) {
    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.active) throw new NotFoundException('Plan not found');
    const extra = await this.referralDiscount(user.id);
    const amountKobo = chargeKobo(plan.amountKobo, plan.promoPercent, extra);
    const reference = paymentReference();

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        status: SubscriptionStatus.PENDING,
      },
    });
    await this.prisma.payment.create({
      data: {
        userId: user.id,
        subscriptionId: subscription.id,
        reference,
        amountKobo,
        discountPercent: plan.promoPercent + extra,
        purpose,
        planCode: plan.code,
      },
    });

    try {
      const checkout = await this.payments.initialize({
        email: user.email,
        amountKobo,
        reference,
        metadata: { userId: user.id, planCode: plan.code, purpose },
      });
      return {
        ...checkout,
        amountKobo,
        chargePrice: naira(amountKobo),
        plan: plan.code,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { reference },
        data: { status: PaymentStatus.FAILED },
      });
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.FAILED },
      });
      throw error;
    }
  }

  private async referralDiscount(userId: string) {
    const [redemption, paid] = await Promise.all([
      this.prisma.referralRedemption.findUnique({ where: { refereeId: userId } }),
      this.prisma.payment.count({
        where: { userId, status: PaymentStatus.SUCCESS },
      }),
    ]);
    if (redemption && paid === 0) return redemption.discountPercent || REFERRAL_DISCOUNT;
    return 0;
  }
}
