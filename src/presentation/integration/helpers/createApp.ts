import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { ClientIssuer } from '@web/infrastructure/db/client-issuer';
import { createRoutes } from '@web/presentation/routes';

export async function createApp() {
  // create separate clients for read and write. Prisma supports overriding the datasource via
  // the `datasources` option on the PrismaClient constructor.
  const writeUrl = process.env.DATABASE_URL_WRITE || process.env.DATABASE_URL;
  const readUrl = process.env.DATABASE_URL_READ || process.env.DATABASE_URL;

  // PrismaClient type definitions may not include the runtime `datasources` override in some versions.
  const PrismaCtor: any = PrismaClient;
  // Ensure datasources uses the { db: { url } } shape which Prisma expects at runtime.
  const prismaWrite = new PrismaCtor({ datasources: { db: { url: writeUrl } } });
  const prismaRead = new PrismaCtor({ datasources: { db: { url: readUrl } } });

  // Create issuer with injected clients and connect
  const issuer = new ClientIssuer(prismaWrite, prismaRead);
  await issuer.connect();

  const repo = new BookRepositoryPrismaImpl(issuer);
  const service = new BookService(repo);
  const app = new Hono();
  app.route('/', createRoutes(service));

  return { app, prismaWrite, prismaRead, issuer };
}

export default createApp;
