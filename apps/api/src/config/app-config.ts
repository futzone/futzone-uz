import { z } from 'zod';

const emptyStringToUndefined = (value: unknown): unknown => value === '' ? undefined : value;

export const AppConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  TEST_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BULLMQ_PREFIX: z.string().min(1).default('bull'),
  ATTENDANCE_EARLY_CANCEL_HOURS: z.coerce.number().positive().default(6),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().min(1),
  JWT_REFRESH_TTL: z.string().min(1),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().min(1),
  SMS_PROVIDER: z.enum(['mock', 'eskiz']),
  MOCK_SMS_URL: z.string().url(),
  ESKIZ_EMAIL: z.string().email().optional(),
  ESKIZ_PASSWORD: z.string().min(1).optional(),
  ESKIZ_FROM: z.string().min(1).optional(),
  WEB_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  ADMIN_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_YANDEX_MAPS_API_KEY: z.string().min(1).optional(),
  MAILPIT_SMTP_HOST: z.string().min(1).optional(),
  MAILPIT_SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  CORS_ORIGINS: z.string().transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SENTRY_DSN: z.preprocess(emptyStringToUndefined, z.string().url().optional()),
  // Web Push (VAPID). All optional: when unset, push delivery is disabled and only in-app fires.
  VAPID_PUBLIC_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  VAPID_PRIVATE_KEY: z.preprocess(emptyStringToUndefined, z.string().min(1).optional()),
  VAPID_SUBJECT: z.string().min(1).default('mailto:support@futzone.uz'),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function validateAppConfig(environment: Record<string, unknown>): AppConfig {
  const result = AppConfigSchema.safeParse(environment);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => `- ${issue.path.join('.') || 'environment'}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
}
