import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { ZodValidationPipe } from './common/validation/zod-validation.pipe';
import { ConfigService } from './config/config.service';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
  // Health probes keep their specified root paths; product routes use /api.
  app.setGlobalPrefix('api', { exclude: [
    { path: 'health', method: RequestMethod.ALL },
    { path: 'health/{*path}', method: RequestMethod.ALL },
  ] });
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new ApiExceptionFilter(app.get(Logger)));
  app.enableShutdownHooks();

  if (config.get('NODE_ENV') !== 'production') setupSwagger(app);
  await app.listen(config.get('API_PORT'));
}

void bootstrap();
