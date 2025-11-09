import { PrismaClient } from '@prisma/client';
import { Book } from '../../domain/model/Book.js';
import { AlreadyLoanedError, DomainValidationError } from '../../domain/errors/customErrors.js';
/**
 * 💡 BOOK_INCLUDES: クエリに必要な関連情報とフィールドを定義
 * 'satisfies' を使用することで、BOOK_INCLUDES を const のまま Prisma の型チェックを受けられる
 */
const BOOK_INCLUDES = {
    bookAuthors: { include: { author: true } },
    loans: {
        where: { returnedAt: null },
        include: { borrower: true, staff: true },
    },
};
function mapLoanRowToLoanInfo(activeLoan) {
    if (!activeLoan)
        return undefined;
    return {
        borrower: activeLoan.borrower?.name ?? undefined,
        borrowerId: activeLoan.borrowerId ?? undefined,
        staff: activeLoan.staff?.name ?? undefined,
        // 日付処理は元のロジックを維持
        loanedAt: activeLoan.loanedAt ? new Date(activeLoan.loanedAt).toISOString() : undefined,
        dueAt: activeLoan.dueAt ? new Date(activeLoan.dueAt).toISOString().slice(0, 10) : undefined,
        status: activeLoan.status ?? undefined,
    };
}
/**
 * 💡 型安全になったマッピング関数
 */
function mapPrismaBookToDomain(r) {
    // r.loans は型安全にアクセス可能
    const activeLoan = r.loans && r.loans.length > 0 ? r.loans[0] : undefined;
    const loanInfo = mapLoanRowToLoanInfo(activeLoan);
    return new Book(String(r.id), // IDはドメイン層でstringと想定
    r.title, 
    // bookAuthors は型安全
    r.bookAuthors && r.bookAuthors.length > 0 ? r.bookAuthors[0].author.name : 'Unknown', r.isbn || '', r.published ? r.published.toISOString().slice(0, 10) : '', r.description || undefined, !activeLoan, loanInfo);
}
// 💡 外部からPrismaClientを注入 (Dependency Injection)
export class BookRepositoryPrismaImpl {
    prisma;
    // コンストラクタでPrismaClientを受け取る。既存コード互換のためデフォルトで new PrismaClient() を作成する
    constructor(prisma = new PrismaClient()) {
        this.prisma = prisma;
    }
    async findAll() {
        // rows: BookRow[] となり型安全性が向上
        const rows = await this.prisma.book.findMany({ include: BOOK_INCLUDES });
        return rows.map(mapPrismaBookToDomain);
    }
    async findByQuery(query) {
        if (!query)
            return this.findAll();
        const rows = await this.prisma.book.findMany({
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
    async findById(id) {
        const r = await this.prisma.book.findUnique({
            where: { id: Number(id) },
            include: BOOK_INCLUDES,
        });
        if (!r)
            return null;
        return mapPrismaBookToDomain(r);
    }
    async createLoanForBook(options) {
        // tx の型を typeof this.prisma にすることで、トランザクション内でも完全な型安全性を維持
        await this.prisma.$transaction(async (tx) => {
            // Ensure book exists
            const book = await tx.book.findUnique({ where: { id: Number(options.bookId) } });
            if (!book)
                throw new Error('Book not found');
            // Prevent creating another active loan if one already exists for this book
            const existingActive = await tx.loan.findFirst({ where: { bookId: Number(options.bookId), returnedAt: null } });
            if (existingActive) {
                // ドメインエラーをスロー
                throw new AlreadyLoanedError('Book is already loaned out');
            }
            let borrowerId = options.borrowerId;
            if (!borrowerId) {
                if (!options.borrowerName)
                    throw new Error('borrowerId or borrowerName is required');
                // find or create borrower by name/email within the transaction
                const existing = await tx.borrower.findFirst({ where: { name: options.borrowerName } });
                if (existing) {
                    borrowerId = existing.id;
                }
                else {
                    const created = await tx.borrower.create({ data: { name: options.borrowerName, email: options.borrowerEmail } });
                    borrowerId = created.id;
                }
            }
            // verify staff exists if provided
            if (options.staffId) {
                const staff = await tx.staff.findUnique({ where: { id: options.staffId } });
                if (!staff) {
                    throw new DomainValidationError('Invalid staffId');
                }
            }
            await tx.loan.create({
                data: {
                    bookId: Number(options.bookId),
                    borrowerId: borrowerId,
                    staffId: options.staffId || null,
                    loanedAt: new Date(),
                    dueAt: options.dueAt ? new Date(options.dueAt) : undefined,
                    returnedAt: null,
                    status: 'loaned',
                },
            });
        });
    }
    async returnBookByBookId(bookId) {
        const loan = await this.prisma.loan.findFirst({ where: { bookId: Number(bookId), returnedAt: null } });
        if (!loan)
            throw new Error('Active loan not found for this book');
        await this.prisma.loan.update({ where: { id: loan.id }, data: { returnedAt: new Date(), status: 'returned' } });
    }
}
