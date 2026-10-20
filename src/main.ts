import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { IncomingMessage } from 'http';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { readEnv } from './config/env';

type RawBodyRequest = IncomingMessage & { rawBody?: Buffer };

function captureRawBody(req: RawBodyRequest, _res: unknown, buffer: Buffer) {
  if (Buffer.isBuffer(buffer) && buffer.length) req.rawBody = buffer;
}

async function bootstrap() {
  const env = readEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.use(json({ limit: '8mb', verify: captureRawBody }));
  app.use(urlencoded({ extended: true, limit: '8mb', verify: captureRawBody }));
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({ origin: env.corsOrigins, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('iBrary API')
    .setDescription(
      [
        'Backend for the iBrary secondary-school learning app.',
        '',
        'Students create an account, sit an onboarding assessment, pick a class such as SS 2, then study terms and subjects, track progress, earn points, and subscribe.',
        '',
        'Sign-in is email/password or Google. Transactional email goes through Resend. Subscriptions are charged with Paystack in Nigerian naira.',
        '',
        'Authorize requests with the access token from `/api/v1/auth/register`, `/api/v1/auth/login`, or `/api/v1/auth/google`. Click Authorize and paste the token.',
        '',
        `Swagger UI: ${env.appUrl}/docs`,
        `OpenAPI JSON: ${env.appUrl}/docs-json`,
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addServer(env.appUrl)
    .addTag('meta', 'Where to find this documentation')
    .addTag('auth', 'Accounts, Google sign-in, sessions, password reset')
    .addTag('users', 'Profile, class level, and class path')
    .addTag('assessments', 'Onboarding and later assessments')
    .addTag('catalog', 'Terms, subjects, search, and classmates')
    .addTag('learning', 'Home, progress, activity, and favourites')
    .addTag('reviews', 'Subject ratings')
    .addTag('gamification', 'Points, leadership board, badges, incentives')
    .addTag('billing', 'Plans, subscribe, switch, cancel, receipts')
    .addTag('payments', 'Paystack checkout, verify, and webhook')
    .addTag('referrals', 'Referral codes and the 10% first-membership discount')
    .addTag('notifications', 'In-app inbox and Resend email preferences')
    .addTag('health', 'Postgres and integration configuration')
    .addTag('admin', 'Oversight for users, catalogue, courses, learning, games, billing, and ads')
    .addTag('courses', 'Courses uploaded by users')
    .addTag('banners', 'Active announcement and ad banners')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'iBrary API docs',
  });

  await app.listen(env.port);
}

void bootstrap();
