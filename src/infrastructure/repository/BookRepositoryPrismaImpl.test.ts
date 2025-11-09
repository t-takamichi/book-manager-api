jest.mock("@prisma/client", () => {
  const book = { findMany: jest.fn(), findUnique: jest.fn() };
  const borrower = { findFirst: jest.fn(), create: jest.fn() };
  const loan = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  const mockClient = { book, borrower, loan, $transaction: jest.fn() };
  const PrismaClient = jest.fn().mockImplementation(() => mockClient);
  return { PrismaClient, __mockClient: mockClient };
});

import { BookRepositoryPrismaImpl } from "./BookRepositoryPrismaImpl";
const prismaModule = require("@prisma/client");
const PrismaClient = prismaModule.PrismaClient as jest.Mock;
const __mockClient = prismaModule.__mockClient;

describe("BookRepositoryPrismaImpl", () => {
  let repo: BookRepositoryPrismaImpl;
  let prismaMock: any;

  beforeEach(() => {
    (PrismaClient as jest.Mock).mockClear();
    repo = new BookRepositoryPrismaImpl();
    prismaMock = __mockClient;
    prismaMock.book.findMany.mockReset();
    prismaMock.book.findUnique.mockReset();
    prismaMock.borrower.findFirst.mockReset();
    prismaMock.borrower.create.mockReset();
    prismaMock.loan.create.mockReset();
    prismaMock.loan.findFirst.mockReset();
    prismaMock.loan.update.mockReset();
    prismaMock.$transaction.mockReset();
  });

  test("findById maps active loan and available=false", async () => {
    const row = {
      id: 1,
      title: "TypeScript入門",
      bookAuthors: [{ author: { name: "山田太郎" } }],
      isbn: "978-4-xxxx-xxxx-1",
      published: new Date("2025-01-01"),
      description: "TypeScriptの基礎から応用まで学べる入門書",
      loans: [
        {
          borrower: { name: "テスト利用者" },
          borrowerId: 1,
          staff: null,
          staffId: null,
          loanedAt: "2025-11-08T05:24:36.000Z",
          dueAt: "2025-11-22T00:00:00.000Z",
          status: "loaned",
        },
      ],
    };

    prismaMock.book.findUnique.mockResolvedValue(row);

    const book = await repo.findById("1");

    expect(book).not.toBeNull();
    expect(book?.available).toBe(false);
    expect(book?.currentLoan).toBeDefined();
    expect(book?.currentLoan?.borrower).toBe("テスト利用者");
    expect(book?.currentLoan?.borrowerId).toBe(1);
    expect(book?.currentLoan?.dueAt).toBe("2025-11-22");
    expect(book?.author).toBe("山田太郎");
  });

  test("findAll maps list", async () => {
    const row = {
      id: 2,
      title: "Honoで作るWebアプリケーション",
      bookAuthors: [{ author: { name: "鈴木花子" } }],
      isbn: "978-4-xxxx-xxxx-2",
      published: new Date("2025-02-15"),
      description: "Honoを使ったモダンなWebアプリケーション開発の解説",
      loans: [],
    };

    prismaMock.book.findMany.mockResolvedValue([row]);

    const books = await repo.findAll();
    expect(Array.isArray(books)).toBe(true);
    expect(books.length).toBe(1);
    expect(books[0].available).toBe(true);
    expect(books[0].author).toBe("鈴木花子");
  });

  test("createLoanForBook runs transaction and creates borrower when absent", async () => {
    // tx mock that simulates transactional client
    const txMock: any = {
      book: { findUnique: jest.fn() },
      borrower: { findFirst: jest.fn(), create: jest.fn() },
      loan: { create: jest.fn(), findFirst: jest.fn() },
    };

    // $transaction should call the callback with txMock
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(txMock));

    txMock.book.findUnique.mockResolvedValue({ id: 3 });
    txMock.borrower.findFirst.mockResolvedValue(null);
    txMock.loan.findFirst.mockResolvedValue(null);
    txMock.borrower.create.mockResolvedValue({ id: 5 });
    txMock.loan.create.mockResolvedValue({ id: 10 });

    await repo.createLoanForBook({
      bookId: "3",
      borrowerName: "新規利用者",
      borrowerEmail: "a@example.com",
    });

    expect(txMock.book.findUnique).toHaveBeenCalledWith({ where: { id: 3 } });
    expect(txMock.borrower.findFirst).toHaveBeenCalledWith({
      where: { name: "新規利用者" },
    });
    expect(txMock.borrower.create).toHaveBeenCalledWith({
      data: { name: "新規利用者", email: "a@example.com" },
    });
    expect(txMock.loan.create).toHaveBeenCalled();
  });
});
