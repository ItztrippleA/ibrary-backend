import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { readEnv } from '../config/env';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Process and dependency health',
    description:
      'Reports whether Postgres answers, and whether Google, Resend, and Paystack keys are present. Secrets are not returned.',
  })
  async check() {
    const env = readEnv();
    let database: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      integrations: {
        google: Boolean(env.googleClientId),
        resend: Boolean(env.resendApiKey),
        paystack: Boolean(env.paystackSecretKey),
      },
      docs: `${env.appUrl}/docs`,
    };
  }
}
