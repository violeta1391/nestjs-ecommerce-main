import { register } from 'tsconfig-paths';
import { resolve } from 'path';
// __dirname = /var/task/back/api  →  baseUrl = /var/task/back
register({ baseUrl: resolve(__dirname, '..'), paths: {} });

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import * as express from 'express';
import type { Request, Response } from 'express';

const server = express();
let isInitialized = false;

async function bootstrap(): Promise<void> {
  if (isInitialized) return;

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    { logger: ['error', 'warn'] },
  );

  app.enableCors({
    origin: process.env.FRONTEND_URL
      ? [process.env.FRONTEND_URL, 'http://localhost:3001']
      : ['http://localhost:3001', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();
  isInitialized = true;
}

export default async function handler(req: Request, res: Response): Promise<void> {
  await bootstrap();
  server(req, res);
}
