import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NextFunction, Request, Response } from 'express';
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

    callback(null, false);
  };
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '12mb' });
  const configService = app.get(ConfigService);
  const corsOrigin = configService.getOrThrow<string>('CORS_ORIGIN');

  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));
  app.enableCors({
    origin: buildCorsOrigin(corsOrigin),
    credentials: true,
  });

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    next();
  });

  await app.listen(configService.getOrThrow<number>('PORT'));
}
bootstrap();
