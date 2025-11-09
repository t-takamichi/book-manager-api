import { Book } from '../../domain/model/Book.js';
import { NotFoundError } from '../../domain/errors/customErrors.js';
import logger from '../../common/logger.js';
import { BookDomainValidator } from '../../domain/validator/BookDomainValidator.js';
import { CheckoutValidator } from '../../domain/validator/CheckoutValidator.js';
export class BookService {
    bookRepository;
    constructor(bookRepository) {
        this.bookRepository = bookRepository;
    }
    async searchBooks(query) {
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
    async getBookById(id) {
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
    async checkoutBook(options) {
        logger.info(`Executing BookService.checkoutBook for bookId: ${options.bookId}`);
        CheckoutValidator.validate(options);
        const book = await this.bookRepository.findById(options.bookId);
        if (!book)
            throw new NotFoundError(`Book with id ${options.bookId} not found.`);
        await this.bookRepository.createLoanForBook(options);
        return (await this.bookRepository.findById(options.bookId));
    }
    async returnBook(bookId) {
        logger.info(`Executing BookService.returnBook for bookId: ${bookId}`);
        const book = await this.bookRepository.findById(bookId);
        if (!book)
            throw new NotFoundError(`Book with id ${bookId} not found.`);
        await this.bookRepository.returnBookByBookId(bookId);
        return (await this.bookRepository.findById(bookId));
    }
}
