import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { createRoutes } from './presentation/routes.js';
import { BookService } from './domain/service/BookService.js';
import { BookRepositoryPrismaImpl } from './infrastructure/repository/BookRepositoryPrismaImpl.js';
const app = new Hono();
async function boot() {
    // If USE_PRISMA environment variable is set to 'true', try to use Prisma implementation.
    const usePrisma = process.env.USE_PRISMA === 'true';
    let bookRepository = new BookRepositoryPrismaImpl();
    const bookService = new BookService(bookRepository);
    // Register routes
    app.route('/', createRoutes(bookService));
    serve({
        fetch: app.fetch,
        port: Number(process.env.PORT || 3000)
    }, (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    });
}
boot();
