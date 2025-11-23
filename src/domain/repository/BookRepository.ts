import { Book } from '@web/domain/model/Book';

export interface BookRepository {
  findAll(): Promise<Book[]>;

  findByQuery(query?: string): Promise<Book[]>;

  /**
   * Find paginated list of books (no search filter). Returns items for the page and total count.
   */
  findPaginated(page: number, perPage: number): Promise<{ items: Book[]; total: number }>;

  /**
   * Find paginated results for a query search.
   * Should apply the same filters as findByQuery but return only the requested page and the total count.
   */
  findByQueryPaginated(
    query: string | undefined,
    page: number,
    perPage: number,
  ): Promise<{ items: Book[]; total: number }>;

  findById(id: string): Promise<Book | null>;
  /**
   * Create a loan for an existing book. Caller must provide a valid borrowerId.
   * This method is responsible for the transactional creation of the loan and
   * ensuring no concurrent active loan exists for the same book.
   */
  createLoanForBook(options: {
    bookId: string;
    borrowerId: number;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book>;

  // Borrower / staff helpers used by service layer to keep repository responsibilities small
  findBorrowerByName(name: string): Promise<{ id: number } | null>;
  createBorrower(options: { name: string; email?: string }): Promise<{ id: number }>;
  findStaffById(id: number): Promise<{ id: number } | null>;
  /**
   * Atomically find or create a borrower by name. Returns the borrower id.
   * This should be implemented transactionally to avoid race conditions.
   */
  findOrCreateBorrower(options: { name: string; email?: string }): Promise<{ id: number }>;

  returnBookByBookId(bookId: string): Promise<Book>;
}
