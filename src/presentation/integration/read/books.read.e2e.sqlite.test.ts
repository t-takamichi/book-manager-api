import { Hono } from 'hono';
import { createRoutes } from '@web/presentation/routes';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { PrismaClient } from '@prisma/client';
import seedFactory from '../helpers/seedFactory';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev-test.db';

describe('E2E read /api/books using SQLite', () => {
  let app: any;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const repo = new BookRepositoryPrismaImpl();
    const service = new BookService(repo);
    app = new Hono();
    app.route('/', createRoutes(service));

    // seed one book with active loan
    const { book } = await seedFactory.createBookWithAuthor(prisma, { title: 'TypeScript入門' });
    const borrower = await seedFactory.createBorrower(prisma, 'テスト利用者', 'test@example.com');
    const staff = await seedFactory.createStaff(prisma, '受付太郎');
    await prisma.loan.create({
      data: {
        bookId: book.id,
        borrowerId: borrower.id,
        staffId: staff.id,
        loanedAt: new Date(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        returnedAt: null,
        status: 'loaned',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('GET /api/books?q=TypeScript returns seeded book', async () => {
    const req = new Request('http://localhost/api/books?q=TypeScript');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].title).toBe('TypeScript入門');
  });

  test('GET /api/books/:id returns book with currentLoan', async () => {
    const req = new Request('http://localhost/api/books/1');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.available).toBe(false);
    expect(body.currentLoan).toBeDefined();
    expect(body.currentLoan.borrower).toBe('テスト利用者');
  });
});
