import { Book } from '@web/domain/model/Book';
import { NotFoundError } from '@web/domain/errors/customErrors';
import logger from '@web/common/logger';
import type { BookRepository } from '@web/domain/repository/BookRepository';
import { BookDomainValidator } from '@web/domain/validator/BookDomainValidator';
import { DomainValidationError } from '@web/domain/errors/customErrors';
import { CheckoutValidator } from '@web/domain/validator/CheckoutValidator';
import type { ISearchBookParams } from '@web/domain/model/SearchBookParams';

export interface IBookService {
  searchBooks(query?: string): Promise<Book[]>;
  /**
   * Search books with pagination. If query is undefined or empty string, behaves like listAllBooks.
   */
  listBooks(
    searchBookParams: ISearchBookParams
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
    searchBookParams: ISearchBookParams
  ): Promise<{ items: Book[]; total: number; page: number; perPage: number }> {

    // normalize pagination params similar to listAllBooks
    const safePerPage = searchBookParams.perPage && searchBookParams.perPage > 0
      ? Math.min(searchBookParams.perPage, 100)
      : 15;
    const safePage = searchBookParams.page && searchBookParams.page > 0 ? searchBookParams.page : 1;

    const { items, total } = await this.bookRepository.findByQueryPaginated(
      searchBookParams.query,
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
    borrowerName: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<Book> {
    logger.info(`Executing BookService.checkoutBook for bookId: ${options.bookId}`);

    CheckoutValidator.validate(options);

    let borrowerId = options.borrowerId;
    if (!borrowerId) {
      // Use atomic find-or-create to avoid race conditions
      const borrower = await this.bookRepository.findOrCreateBorrower({
        name: options.borrowerName,
        email: options.borrowerEmail,
      });
      borrowerId = borrower.id;
    }

    if (options.staffId) {
      const staff = await this.bookRepository.findStaffById(options.staffId);
      if (!staff) {
        // staff id is a domain validation problem — throw DomainValidationError so
        // the error-response mapping produces 422 as expected by tests/E2E
        throw new DomainValidationError('Invalid staffId');
      }
    }

    const created = await this.bookRepository.createLoanForBook({
      bookId: options.bookId,
      borrowerId: borrowerId!,
      staffId: options.staffId,
      dueAt: options.dueAt,
    });

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
