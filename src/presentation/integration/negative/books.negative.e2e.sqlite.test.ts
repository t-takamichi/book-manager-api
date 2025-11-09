import { Hono } from 'hono';
import { createRoutes } from '@web/presentation/routes';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { PrismaClient } from '@prisma/client';
import seedFactory from '../helpers/seedFactory';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev-test.db';

describe('E2E negative /api/books using SQLite', () => {
  let app: any;
  let prisma: PrismaClient;
  let seededBookId: number | string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const repo = new BookRepositoryPrismaImpl();
    const service = new BookService(repo);
    app = new Hono();
    app.route('/', createRoutes(service));

    const result = await seedFactory.createBookWithAuthor(prisma, { title: '異常系テストブック' });
    await seedFactory.createStaff(prisma, '受付次郎');
    seededBookId = result.book.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('validation error when missing borrower info returns 422', async () => {
    const payload = { staffId: 1, dueAt: '2025-11-22' };
    const req = new Request(`http://localhost/api/books/${seededBookId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await app.fetch(req);
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toMatch(/borrowerId or borrowerName/);
  });

  test('cannot checkout an already loaned book', async () => {
    const first = await app.fetch(new Request(`http://localhost/api/books/${seededBookId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrowerName: 'First', borrowerEmail: 'first@example.com', staffId: 1 }),
    }));
    expect(first.status).toBe(200);

    const second = await app.fetch(new Request(`http://localhost/api/books/${seededBookId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrowerName: 'Second', borrowerEmail: 'second@example.com', staffId: 1 }),
    }));

    expect(second.status).toBe(422);
    const body = await second.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toMatch(/already loaned/i);
  });

  test('invalid staffId returns 422', async () => {
    const newResult = await seedFactory.createBookWithAuthor(prisma, { title: '無効staffId用の本' });

    const res = await app.fetch(new Request(`http://localhost/api/books/${newResult.book.id}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ borrowerName: 'NoStaff', borrowerEmail: 'nostaff@example.com', staffId: 99999 }),
    }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toMatch(/Invalid staffId|staffId/i);
  });
});
