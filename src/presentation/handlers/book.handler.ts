import type { Context } from 'hono';
import logger from '@web/common/logger';
import { ErrorResponseHandler } from '@web/domain/errors/errorResponseHandler';
import type { IBookService } from '@web/domain/service/BookService';
import { BookQueryValidator } from '@web/presentation/validators/bookQueryValidator';
import { buildCheckoutOptionsFromBody } from '@web/presentation/validators/checkoutRequestValidator';


export const searchBooks = (bookService: IBookService) => async (c: Context) => {
  try {
    const query = c.req.query('q');
    logger.info(`Search query received: ${query}`);

    BookQueryValidator.validateQuery(query);

    const searchResults = await bookService.searchBooks(query);
    logger.info(`Search results found: ${searchResults.length} items`);

    return c.json(searchResults);
  } catch (error) {
    const { statusCode, body } = ErrorResponseHandler.generate(error);

    return c.json(body, statusCode);
  }
};

export const getBookById = (bookService: IBookService) => async (c: Context) => {
  try {
    const id = c.req.param('id');
    logger.info(`GET book by id received: ${id}`);

    const book = await bookService.getBookById(id);
    return c.json(book);
  } catch (error) {
    const { statusCode, body } = ErrorResponseHandler.generate(error);
    return c.json(body, statusCode);
  }
};

export const checkoutBook = (bookService: IBookService) => async (c: Context) => {
  try {
    const bookId = c.req.param('id');
    const body = await c.req.json();

    logger.info(`Checkout request for bookId=${bookId} payload=${JSON.stringify(body)}`);

    // Use presentation validator to build a cleaned DTO for the domain
    const checkoutOptions = buildCheckoutOptionsFromBody(bookId, body);

    const updated = await bookService.checkoutBook(checkoutOptions as any);

    return c.json(updated);
  } catch (error) {
    const { statusCode, body } = ErrorResponseHandler.generate(error);
    return c.json(body, statusCode);
  }
};

export const returnBook = (bookService: IBookService) => async (c: Context) => {
  try {
    const bookId = c.req.param('id');

    logger.info(`Return request for bookId=${bookId}`);

    const updated = await bookService.returnBook(bookId);

    return c.json(updated);
  } catch (error) {
    const { statusCode, body } = ErrorResponseHandler.generate(error);
    return c.json(body, statusCode);
  }
};