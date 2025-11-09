import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { createRoutes } from '@web/presentation/routes';

export async function createApp() {
  const prisma = new PrismaClient();
  await prisma.$connect();

  const repo = new BookRepositoryPrismaImpl();
  const service = new BookService(repo);
  const app = new Hono();
  app.route('/', createRoutes(service));

  return { app, prisma };
}

export default createApp;
