# iBrary API

NestJS backend for the iBrary secondary-school learning app.

Students register, sit an onboarding assessment, pick a class (for example SS 2), study terms and subjects, track progress, earn points, and subscribe. Sign-in is email and password or Google. Email goes through Resend. Subscriptions are charged with Paystack in naira.

## Documentation

When the API is running:

- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)
- OpenAPI JSON: [http://localhost:3000/docs-json](http://localhost:3000/docs-json)
- Short index (same links): [http://localhost:3000/api/v1](http://localhost:3000/api/v1)

In Swagger, call register or login, then Authorize with the `accessToken`.

## Run locally

```bash
docker compose up -d
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run start:dev
```

Postgres from Docker listens on `localhost:5433` (mapped to 5432 inside the container) with user `ibrary`, password `ibrary`, database `ibrary`. Port 5433 avoids a Postgres that may already be running on 5432.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Session signing. Replace the dev values before any shared deployment |
| `GOOGLE_CLIENT_ID` | Audience used to verify Google ID tokens on `POST /api/v1/auth/google` |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email. If the key is empty, messages are logged and the API still runs |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | Initialize charges, verify them, and check webhook signatures |
| `APP_URL` | Used in email links and the Paystack callback. Default `http://localhost:3000` |

Paystack should send webhooks to `POST /api/v1/payments/paystack/webhook`.

## Modules

Auth, users, assessments, catalog, learning, reviews, gamification, billing, payments, referrals, and notifications. Health is `GET /api/v1/health`.
# ibrary-backend
