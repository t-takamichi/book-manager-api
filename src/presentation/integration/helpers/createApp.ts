import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { createIssuerFromEnv } from '@web/infrastructure/db/client-issuer';
import { createRoutes } from '@web/presentation/routes';

export async function createApp() {
  // Create an issuer from environment variables (convenience factory).
  // For production apps you may prefer to construct PrismaClient instances in
  // your bootstrap and inject them explicitly; this factory is useful for tests
  // and simple local setups.
  const issuer = createIssuerFromEnv();
  await issuer.connect();

  const repo = new BookRepositoryPrismaImpl(issuer);
  const service = new BookService(repo);
  const app = new Hono();
  // Allow cross-origin requests in development and integration scenarios.
  // Controlled by environment if you want stricter policy in production.
  app.use('*', cors({ origin: '*' }));
  app.route('/', createRoutes(service));

  return { app, issuer };
}

export default createApp;
