import { Book } from '@web/domain/model/Book';
import type { DatabaseClient } from '@web/infrastructure/db/client-issuer';

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

  createLoanForBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book>;

  returnBookByBookId(bookId: string): Promise<Book>;
}
