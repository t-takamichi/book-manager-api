import { Book } from '@web/domain/model/Book';
import { NotFoundError } from '@web/domain/errors/customErrors';
import logger from '@web/common/logger';
import type { BookRepository } from '@web/domain/repository/BookRepository';
import { BookDomainValidator } from '@web/domain/validator/BookDomainValidator';
import { CheckoutValidator } from '@web/domain/validator/CheckoutValidator';

export interface IBookService {
  searchBooks(query?: string): Promise<Book[]>;
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

    const book = await this.bookRepository.findById(options.bookId);
    if (!book) throw new NotFoundError(`Book with id ${options.bookId} not found.`);

    await this.bookRepository.createLoanForBook(options);

    return (await this.bookRepository.findById(options.bookId)) as Book;
  }

  async returnBook(bookId: string): Promise<Book> {
    logger.info(`Executing BookService.returnBook for bookId: ${bookId}`);

    const book = await this.bookRepository.findById(bookId);
    if (!book) throw new NotFoundError(`Book with id ${bookId} not found.`);

    await this.bookRepository.returnBookByBookId(bookId);

    return (await this.bookRepository.findById(bookId)) as Book;
  }
}