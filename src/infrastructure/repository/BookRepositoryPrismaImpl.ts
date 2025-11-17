import type { ClientIssuer, TxClient } from '@web/infrastructure/db/client-issuer';

import { Book } from '@web/domain/model/Book';
import type { LoanInfo } from '@web/domain/model/Book';
import type { BookRepository } from '@web/domain/repository/BookRepository';
import { AlreadyLoanedError, DomainValidationError } from '@web/domain/errors/customErrors';

const BOOK_INCLUDES = {
  bookAuthors: { include: { author: true } },
  loans: {
    where: { returnedAt: null },
    include: { borrower: true, staff: true },
  },
} as const;

type BookRow = {
  id: number;
  title: string;
  bookAuthors?: Array<{ author: { name: string } }>;
  isbn?: string | null;
  published?: Date | null;
  description?: string | null;
  loans?: Array<{
    id: number;
    borrowerId?: number | null;
    borrower?: { name?: string | null } | null;
    staff?: { name?: string | null } | null;
    loanedAt?: Date | null;
    dueAt?: Date | null;
    status?: string | null;
    returnedAt?: Date | null;
  }> | null;
};

type LoanRow = NonNullable<BookRow['loans']>[number];

function mapLoanRowToLoanInfo(activeLoan: LoanRow | undefined): LoanInfo | undefined {
  if (!activeLoan) return undefined;

  return {
    borrower: activeLoan.borrower?.name ?? undefined,
    borrowerId: activeLoan.borrowerId ?? undefined,
    staff: activeLoan.staff?.name ?? undefined,
    loanedAt: activeLoan.loanedAt ? new Date(activeLoan.loanedAt).toISOString() : undefined,
    dueAt: activeLoan.dueAt ? new Date(activeLoan.dueAt).toISOString().slice(0, 10) : undefined,
    status: activeLoan.status ?? undefined,
  };
}

function mapPrismaBookToDomain(r: BookRow): Book {
  const activeLoan: LoanRow | undefined = r.loans && r.loans.length > 0 ? r.loans[0] : undefined;
  const loanInfo = mapLoanRowToLoanInfo(activeLoan);

  return new Book(
    String(r.id),
    r.title,
    r.bookAuthors && r.bookAuthors.length > 0 ? r.bookAuthors[0].author.name : 'Unknown',
    r.isbn || '',
    r.published ? r.published.toISOString().slice(0, 10) : '',
    r.description || undefined,
    !activeLoan,
    loanInfo,
  );
}

export class BookRepositoryPrismaImpl implements BookRepository {
  constructor(private readonly issuer: ClientIssuer) {}

  async findAll(): Promise<Book[]> {
    return this.issuer.queryOnReplica(async (client) => {
      const rows: BookRow[] = await client.book.findMany({ include: BOOK_INCLUDES });
      return rows.map(mapPrismaBookToDomain);
    });
  }

  async findPaginated(page: number, perPage: number): Promise<{ items: Book[]; total: number }> {
    const safePerPage = perPage && perPage > 0 ? Math.min(perPage, 100) : 15;
    const safePage = page && page > 0 ? page : 1;

    const skip = (safePage - 1) * safePerPage;

    return this.issuer.queryOnReplica(async (client) => {
      const total = await client.book.count();

      const rows: BookRow[] = await client.book.findMany({
        include: BOOK_INCLUDES,
        skip,
        take: safePerPage,
      });

      const items = rows.map(mapPrismaBookToDomain);
      return { items, total };
    });
  }

  async findByQueryPaginated(
    query: string | undefined,
    page: number,
    perPage: number,
  ): Promise<{ items: Book[]; total: number }> {
    const safePerPage = perPage && perPage > 0 ? Math.min(perPage, 100) : 15;
    const safePage = page && page > 0 ? page : 1;

    const skip = (safePage - 1) * safePerPage;

    const where =
      query && query.trim() !== ''
        ? {
            OR: [
              { title: { contains: query } },
              { isbn: { contains: query } },
              { description: { contains: query } },
              { bookAuthors: { some: { author: { name: { contains: query } } } } },
            ],
          }
        : undefined;

    return this.issuer.queryOnReplica(async (client) => {
      const total = await client.book.count({ where });

      const rows: BookRow[] = await client.book.findMany({
        where,
        include: BOOK_INCLUDES,
        skip,
        take: safePerPage,
      });

      const items = rows.map(mapPrismaBookToDomain);
      return { items, total };
    });
  }

  async findByQuery(query: string | undefined): Promise<Book[]> {
    if (!query) return this.findAll();

    return this.issuer.queryOnReplica(async (client) => {
      const rows: BookRow[] = await client.book.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { isbn: { contains: query } },
            { description: { contains: query } },
            { bookAuthors: { some: { author: { name: { contains: query } } } } },
          ],
        },
        include: BOOK_INCLUDES,
      });

      return rows.map(mapPrismaBookToDomain);
    });
  }

  async findById(id: string): Promise<Book | null> {
    return this.issuer.queryOnReplica(async (client) => {
      const r: BookRow | null = await client.book.findUnique({
        where: { id: Number(id) },
        include: BOOK_INCLUDES,
      });

      if (!r) return null;
      return mapPrismaBookToDomain(r);
    });
  }

  async createLoanForBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book> {
    await this.issuer.transactOnPrimary(async (tx: TxClient) => {
      const book = await tx.book.findUnique({ where: { id: Number(options.bookId) } });
      if (!book) throw new Error('Book not found');

      const existingActive = await tx.loan.findFirst({
        where: { bookId: Number(options.bookId), returnedAt: null },
      });
      if (existingActive) {
        throw new AlreadyLoanedError('Book is already loaned out');
      }

      let borrowerId = options.borrowerId;
      if (!borrowerId) {
        if (!options.borrowerName) throw new Error('borrowerId or borrowerName is required');
        const existing = await tx.borrower.findFirst({ where: { name: options.borrowerName } });
        if (existing) {
          borrowerId = existing.id;
        } else {
          const created = await tx.borrower.create({
            data: { name: options.borrowerName, email: options.borrowerEmail },
          });
          borrowerId = created.id;
        }
      }

      if (options.staffId) {
        const staff = await tx.staff.findUnique({ where: { id: options.staffId } });
        if (!staff) {
          throw new DomainValidationError('Invalid staffId');
        }
      }

      await tx.loan.create({
        data: {
          bookId: Number(options.bookId),
          borrowerId: borrowerId!,
          staffId: options.staffId || null,
          loanedAt: new Date(),
          dueAt: options.dueAt ? new Date(options.dueAt) : undefined,
          returnedAt: null,
          status: 'loaned',
        },
      });
    });

    const fresh = await this.issuer.queryOnReplica(
      async (client) => {
        const r: BookRow | null = await client.book.findUnique({
          where: { id: Number(options.bookId) },
          include: BOOK_INCLUDES,
        });
        if (!r) throw new Error('Book not found after create');
        return mapPrismaBookToDomain(r);
      },
      { requireFresh: true },
    );

    return fresh;
  }

  async returnBookByBookId(bookId: string): Promise<Book> {
    await this.issuer.transactOnPrimary(async (tx: TxClient) => {
      const loan = await tx.loan.findFirst({ where: { bookId: Number(bookId), returnedAt: null } });
      if (!loan) throw new Error('Active loan not found for this book');

      await tx.loan.update({
        where: { id: loan.id },
        data: { returnedAt: new Date(), status: 'returned' },
      });
    });

    const fresh = await this.issuer.queryOnReplica(
      async (client) => {
        const r: BookRow | null = await client.book.findUnique({
          where: { id: Number(bookId) },
          include: BOOK_INCLUDES,
        });
        if (!r) throw new Error('Book not found after return');
        return mapPrismaBookToDomain(r);
      },
      { requireFresh: true },
    );

    return fresh;
  }
}
