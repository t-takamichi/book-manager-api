import { Book } from '@web/domain/model/Book';
import { NotFoundError } from '@web/domain/errors/customErrors';
import logger from '@web/common/logger';
import type { BookRepository } from '@web/domain/repository/BookRepository';
import { BookDomainValidator } from '@web/domain/validator/BookDomainValidator';
import { CheckoutValidator } from '@web/domain/validator/CheckoutValidator';

export interface IBookService {
  searchBooks(query?: string): Promise<Book[]>;
  /**
   * Search books with pagination. If query is undefined or empty string, behaves like listAllBooks.
   */
  listBooks(
    query: string | undefined,
    page?: number,
    perPage?: number,
  ): Promise<{ items: Book[]; total: number; page: number; perPage: number }>;
  // listAllBooks returns paginated listing of all books (no search filter)
  listAllBooks(
    page?: number,
    perPage?: number,
  ): Promise<{ items: Book[]; total: number; page: number; perPage: number }>;
  getBookById(id: string): Promise<Book>;
  checkoutBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book>;
  returnBook(bookId: string): Promise<Book>;
}

export class BookService implements IBookService {
  constructor(private bookRepository: BookRepository) {}

  async searchBooks(query?: string): Promise<Book[]> {
    logger.info(`Executing BookService.searchBooks with query: ${query}`);

    BookDomainValidator.validate(query);

    const results = await this.bookRepository.findByQuery(query);

    if (results.length === 0) {
      logger.warn('No books found for the given query');
      throw new NotFoundError('No books found for the given query.');
    }

    logger.info(`Found ${results.length} books for the given query`);
    return results;
  }

  async listBooks(
    query: string | undefined,
    page: number = 1,
    perPage: number = 15,
  ): Promise<{ items: Book[]; total: number; page: number; perPage: number }> {
    logger.info(
      `Executing BookService.listBooks with query: ${query} page=${page} perPage=${perPage}`,
    );

    // apply domain validation rules (e.g. minimum length) when query present
    if (query && query.trim() !== '') {
      BookDomainValidator.validate(query);
    }

    const safePerPage = perPage && perPage > 0 ? Math.min(perPage, 100) : 15;
    const safePage = page && page > 0 ? page : 1;

    const { items, total } = await this.bookRepository.findByQueryPaginated(
      query,
      safePage,
      safePerPage,
    );

    return { items, total, page: safePage, perPage: safePerPage };
  }

  async getBookById(id: string): Promise<Book> {
    logger.info(`Executing BookService.getBookById with id: ${id}`);

    if (!id) {
      throw new NotFoundError('Book id is required.');
    }

    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError(`Book with id ${id} not found.`);
    }

    return book;
  }

  async checkoutBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book> {
    logger.info(`Executing BookService.checkoutBook for bookId: ${options.bookId}`);

    CheckoutValidator.validate(options);

    const created = await this.bookRepository.createLoanForBook(options);
    return created;
  }

  async returnBook(bookId: string): Promise<Book> {
    logger.info(`Executing BookService.returnBook for bookId: ${bookId}`);

    const updated = await this.bookRepository.returnBookByBookId(bookId);
    return updated;
  }

  async listAllBooks(
    page: number = 1,
    perPage: number = 15,
  ): Promise<{ items: Book[]; total: number; page: number; perPage: number }> {
    logger.info(`Executing BookService.listAllBooks page=${page} perPage=${perPage}`);

    const safePerPage = perPage && perPage > 0 ? Math.min(perPage, 100) : 15;
    const safePage = page && page > 0 ? page : 1;

    const { items, total } = await this.bookRepository.findPaginated(safePage, safePerPage);

    return { items, total, page: safePage, perPage: safePerPage };
  }
}
