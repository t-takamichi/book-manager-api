import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createRoutes } from '@web/presentation/routes'
import { BookService } from '@web/domain/service/BookService';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';

const app = new Hono()

async function boot() {
  const usePrisma = process.env.USE_PRISMA === 'true';


  let bookRepository = new BookRepositoryPrismaImpl();
  const bookService = new BookService(bookRepository);

  app.route('/', createRoutes(bookService));

  serve({
    fetch: app.fetch,
    port: Number(process.env.PORT || 3000)
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  })
}

boot();
