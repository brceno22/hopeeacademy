import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { randomUUID } from 'crypto';

// Cargar .env ANTES de Nest (override: evita que un PORT viejo del entorno gane)
loadEnv({ path: resolve(process.cwd(), '.env'), override: true });

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
  });

  app.use(
    helmet({
      // Permitir que el front (otro origin, p.ej. :5173) cargue /files/proxy en <img> / <iframe>
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // SAMEORIGIN bloquea el PDF en iframe desde Vite (:5173) → API (:3003)
      frameguard: false,
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Permitir embeber respuestas de esta API (PDF proxy) desde el front
          'frame-ancestors': [
            "'self'",
            ...corsOrigins,
          ],
        },
      },
    }),
  );

  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', id);
    (req as Request & { requestId?: string }).requestId = id;
    next();
  });

  // Default body limit 1mb; tasks upload needs more on that route only
  app.use('/tasks', json({ limit: '50mb' }), urlencoded({ limit: '50mb', extended: true }));
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ limit: '1mb', extended: true }));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT) || 3003;
  await app.listen(port);
  console.log(`🚀 Backend corriendo en: http://localhost:${port}`);
}
bootstrap();
