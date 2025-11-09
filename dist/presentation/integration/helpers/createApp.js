import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import { BookRepositoryPrismaImpl } from '../../../infrastructure/repository/BookRepositoryPrismaImpl.js';
import { BookService } from '../../../domain/service/BookService.js';
import { createRoutes } from '../../../presentation/routes.js';
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
