import { Hono } from 'hono';
import { createRoutes } from '@web/presentation/routes';
import { BookRepositoryPrismaImpl } from '@web/infrastructure/repository/BookRepositoryPrismaImpl';
import { BookService } from '@web/domain/service/BookService';
import { PrismaClient } from '@prisma/client';
import seedFactory from '../helpers/seedFactory';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev-test.db';

describe('E2E write /api/books', () => {
  let app: any;
  let prisma: PrismaClient;
  let seededBookId: number | string;
  let seededStaffId: number;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();

    const issuerModule = await import('@web/infrastructure/db/client-issuer');
    const issuer = new issuerModule.ClientIssuer(prisma, prisma);
    const repo = new BookRepositoryPrismaImpl(issuer);
    const service = new BookService(repo);
    app = new Hono();
    app.route('/', createRoutes(service));

    const result = await seedFactory.createBookWithAuthor(prisma, { title: 'TDD入門' });
    const staff = await seedFactory.createStaff(prisma, '受付花子');
    seededBookId = result.book.id;
    seededStaffId = staff.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('POST /api/books/:id/checkout then GET returns currentLoan', async () => {
    const checkoutPayload = {
      borrowerName: 'E2E 利用者',
      borrowerEmail: 'e2e@example.com',
      staffId: seededStaffId,
      dueAt: '2025-11-22',
    };

    const checkoutReq = new Request(`http://localhost/api/books/${seededBookId}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(checkoutPayload),
    });

    const checkoutRes = await app.fetch(checkoutReq);
    expect(checkoutRes.status).toBe(200);
    const checkoutBody = await checkoutRes.json();
    expect(checkoutBody.available).toBe(false);
    expect(checkoutBody.currentLoan).toBeDefined();
    expect(checkoutBody.currentLoan.borrower).toBe('E2E 利用者');

    const getReq = new Request(`http://localhost/api/books/${seededBookId}`);
    const getRes = await app.fetch(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.available).toBe(false);
    expect(getBody.currentLoan).toBeDefined();
  });

  test('POST /api/books/:id/return then GET returns available=true', async () => {
    const returnReq = new Request(`http://localhost/api/books/${seededBookId}/return`, {
      method: 'POST',
    });

    const returnRes = await app.fetch(returnReq);
    expect(returnRes.status).toBe(200);
    const returnBody = await returnRes.json();
    expect(returnBody.available).toBe(true);
    expect(returnBody.currentLoan).toBeFalsy();

    const getReq2 = new Request(`http://localhost/api/books/${seededBookId}`);
    const getRes2 = await app.fetch(getReq2);
    expect(getRes2.status).toBe(200);
    const getBody2 = await getRes2.json();
    expect(getBody2.available).toBe(true);
    expect(getBody2.currentLoan).toBeFalsy();
  });
});
