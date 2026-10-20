export type AppEnv = {
  nodeEnv: string;
  port: number;
  appUrl: string;
  corsOrigins: string[];
  databaseUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  googleClientId: string;
  resendApiKey: string;
  emailFrom: string;
  paystackSecretKey: string;
  paystackPublicKey: string;
  storageDriver: 'local' | 's3';
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3PublicUrl: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiTtsModel: string;
  openaiGuideVoice: string;
  openaiStudentVoice: string;
};

const DEV_ACCESS = 'dev-access-secret-change-me';
const DEV_REFRESH = 'dev-refresh-secret-change-me';

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = source.NODE_ENV ?? 'development';
  const jwtAccessSecret = source.JWT_ACCESS_SECRET ?? DEV_ACCESS;
  const jwtRefreshSecret = source.JWT_REFRESH_SECRET ?? DEV_REFRESH;

  if (nodeEnv === 'production') {
    if (!source.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (
      !source.JWT_ACCESS_SECRET ||
      !source.JWT_REFRESH_SECRET ||
      source.JWT_ACCESS_SECRET === DEV_ACCESS ||
      source.JWT_REFRESH_SECRET === DEV_REFRESH
    ) {
      throw new Error('Set unique JWT_ACCESS_SECRET and JWT_REFRESH_SECRET in production');
    }
  }

  return {
    nodeEnv,
    port: Number(source.PORT ?? 3000),
    appUrl: (source.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    corsOrigins: (source.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:5174')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    databaseUrl:
      source.DATABASE_URL ??
      'postgresql://ibrary:ibrary@localhost:5433/ibrary?schema=public',
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessTtl: source.JWT_ACCESS_TTL ?? '15m',
    jwtRefreshTtl: source.JWT_REFRESH_TTL ?? '7d',
    googleClientId: source.GOOGLE_CLIENT_ID ?? '',
    resendApiKey: source.RESEND_API_KEY ?? '',
    emailFrom: source.EMAIL_FROM ?? 'iBrary <onboarding@resend.dev>',
    paystackSecretKey: source.PAYSTACK_SECRET_KEY ?? '',
    paystackPublicKey: source.PAYSTACK_PUBLIC_KEY ?? '',
    storageDriver: source.STORAGE_DRIVER === 's3' ? 's3' : 'local',
    s3Bucket: source.AWS_S3_BUCKET ?? '',
    s3Region: source.AWS_S3_REGION ?? '',
    s3AccessKeyId: source.AWS_ACCESS_KEY_ID ?? '',
    s3SecretAccessKey: source.AWS_SECRET_ACCESS_KEY ?? '',
    s3PublicUrl: (source.AWS_S3_PUBLIC_URL ?? '').replace(/\/$/, ''),
    openaiApiKey: source.OPENAI_API_KEY ?? '',
    openaiModel: source.OPENAI_MODEL ?? 'gpt-4o',
    openaiTtsModel: source.OPENAI_TTS_MODEL ?? 'tts-1-hd',
    openaiGuideVoice: source.OPENAI_GUIDE_VOICE ?? 'alloy',
    openaiStudentVoice: source.OPENAI_STUDENT_VOICE ?? 'nova',
  };
}
