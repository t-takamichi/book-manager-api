import logger from '../../common/logger.js';
import { ErrorResponseHandler } from '../../domain/errors/errorResponseHandler.js';
import { BookQueryValidator } from '../../presentation/validators/bookQueryValidator.js';
export const searchBooks = (bookService) => async (c) => {
    try {
        const query = c.req.query('q');
        logger.info(`Search query received: ${query}`);
        BookQueryValidator.validateQuery(query);
        const searchResults = await bookService.searchBooks(query);
        logger.info(`Search results found: ${searchResults.length} items`);
        return c.json(searchResults);
    }
    catch (error) {
        const { statusCode, body } = ErrorResponseHandler.generate(error);
        return c.json(body, statusCode);
    }
};
export const getBookById = (bookService) => async (c) => {
    try {
        const id = c.req.param('id');
        logger.info(`GET book by id received: ${id}`);
        const book = await bookService.getBookById(id);
        return c.json(book);
    }
    catch (error) {
        const { statusCode, body } = ErrorResponseHandler.generate(error);
        return c.json(body, statusCode);
    }
};
export const checkoutBook = (bookService) => async (c) => {
    try {
        const bookId = c.req.param('id');
        const body = await c.req.json();
        logger.info(`Checkout request for bookId=${bookId} payload=${JSON.stringify(body)}`);
        // allow either borrowerId or borrowerName+email
        const { borrowerId, borrowerName, borrowerEmail, staffId, dueAt } = body || {};
        if (!borrowerId && !borrowerName) {
            return c.json({ message: 'borrowerId or borrowerName is required' }, 422);
        }
        const updated = await bookService.checkoutBook({
            bookId,
            borrowerId,
            borrowerName,
            borrowerEmail,
            staffId,
            dueAt,
        });
        return c.json(updated);
    }
    catch (error) {
        const { statusCode, body } = ErrorResponseHandler.generate(error);
        return c.json(body, statusCode);
    }
};
export const returnBook = (bookService) => async (c) => {
    try {
        const bookId = c.req.param('id');
        logger.info(`Return request for bookId=${bookId}`);
        const updated = await bookService.returnBook(bookId);
        return c.json(updated);
    }
    catch (error) {
        const { statusCode, body } = ErrorResponseHandler.generate(error);
        return c.json(body, statusCode);
    }
};
