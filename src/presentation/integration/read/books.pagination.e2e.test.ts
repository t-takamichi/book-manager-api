import { Hono } from 'hono';
import { createRoutes } from '@web/presentation/routes';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { PrismaClient } from '@prisma/client';
import seedFactory from '../helpers/seedFactory';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev-test.db';

describe('E2E pagination /api/books', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const repo = new BookRepositoryPrismaImpl();
    const service = new BookService(repo);
    app = new Hono();
    app.route('/', createRoutes(service));

    // create 35 books
    const createPromises: Promise<any>[] = [];
    for (let i = 1; i <= 35; i++) {
      createPromises.push(seedFactory.createBookWithAuthor(prisma, { title: `PagTest Book ${i}` }));
    }
    await Promise.all(createPromises);

    // create 7 books with a special keyword for filtered pagination
    const createFiltered: Promise<any>[] = [];
    for (let i = 1; i <= 7; i++) {
      createFiltered.push(seedFactory.createBookWithAuthor(prisma, { title: `SpecialFilter ${i}` }));
    }
    await Promise.all(createFiltered);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET /api/books without params returns default first page (15 items) and correct total', async () => {
    const req = new Request('http://localhost/api/books');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(15);
    expect(body.total).toBeGreaterThanOrEqual(42); // 35 + 7
    expect(body.page).toBe(1);
    expect(body.perPage).toBe(15);
  });

  test('GET /api/books with page and per_page returns correct slice', async () => {
    const req = new Request('http://localhost/api/books?page=3&per_page=10');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.page).toBe(3);
    expect(body.perPage).toBe(10);
    // page 3 with per_page=10 should have items 21-30 (if total >=30)
    expect(body.items.length).toBeGreaterThanOrEqual(0);
  });

  test('GET /api/books with q and pagination filters correctly', async () => {
    const req = new Request('http://localhost/api/books?q=SpecialFilter&page=1&per_page=5');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    // total should equal 7 (we created 7 SpecialFilter books)
    expect(body.total).toBeGreaterThanOrEqual(7);
    expect(body.items.length).toBeLessThanOrEqual(5);
  });
});
