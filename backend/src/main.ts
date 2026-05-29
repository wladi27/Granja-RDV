import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCorsOrigin(rawOrigins: string) {
  const allowedOrigins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes('*');
  const exactOrigins = new Set(allowedOrigins.filter((origin) => origin !== '*' && !origin.includes('*')));
  const wildcardPatterns = allowedOrigins
    .filter((origin) => origin.includes('*'))
    .map((origin) => new RegExp(`^${escapeRegex(origin).replace(/\\\*/g, '.*')}$`));

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin || allowAll || exactOrigins.has(origin) || wildcardPatterns.some((pattern) => pattern.test(origin))) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigin = configService.getOrThrow<string>('CORS_ORIGIN');

  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));
  app.enableCors({
    origin: buildCorsOrigin(corsOrigin),
    credentials: true,
  });

  await app.listen(configService.getOrThrow<number>('PORT'));
}
bootstrap();
