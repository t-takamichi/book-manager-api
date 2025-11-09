import { PrismaClient } from '@prisma/client';
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
    loanInfo
  );
}

export class BookRepositoryPrismaImpl implements BookRepository {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async findAll(): Promise<Book[]> {
    const rows: BookRow[] = await this.prisma.book.findMany({ include: BOOK_INCLUDES });
    return rows.map(mapPrismaBookToDomain);
  }

  async findByQuery(query?: string): Promise<Book[]> {
    if (!query) return this.findAll();

    const rows: BookRow[] = await this.prisma.book.findMany({
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
  }

  async findById(id: string): Promise<Book | null> {
    const r: BookRow | null = await this.prisma.book.findUnique({
      where: { id: Number(id) },
      include: BOOK_INCLUDES,
    });

    if (!r) return null;

    return mapPrismaBookToDomain(r);
  }

  async createLoanForBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }
  ): Promise<void> {
  await this.prisma.$transaction(async (tx: typeof this.prisma) => {
      const book = await tx.book.findUnique({ where: { id: Number(options.bookId) } });
      if (!book) throw new Error('Book not found');

      const existingActive = await tx.loan.findFirst({ where: { bookId: Number(options.bookId), returnedAt: null } });
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
          const created = await tx.borrower.create({ data: { name: options.borrowerName, email: options.borrowerEmail } });
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
  }

  async returnBookByBookId(bookId: string): Promise<void> {
    const loan = await this.prisma.loan.findFirst({ where: { bookId: Number(bookId), returnedAt: null } });
    if (!loan) throw new Error('Active loan not found for this book');

    await this.prisma.loan.update({ where: { id: loan.id }, data: { returnedAt: new Date(), status: 'returned' } });
  }
}
