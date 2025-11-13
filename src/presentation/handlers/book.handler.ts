import type { Context } from 'hono';
import logger from '@web/common/logger';
import { ErrorResponseHandler } from '@web/domain/errors/errorResponseHandler';
import type { IBookService } from '@web/domain/service/BookService';
import { BookQueryValidator } from '@web/presentation/validators/bookQueryValidator';
import { buildCheckoutOptionsFromBody } from '@web/presentation/validators/checkoutRequestValidator';


export const searchBooks = (bookService: IBookService) => async (c: Context) => {
  try {
    const query = c.req.query('q');

    // pagination params for search
    const pageParam = c.req.query('page');
    const perPageParam = c.req.query('per_page') || c.req.query('perPage');

    const page = pageParam ? Number(pageParam) : 1;
    const perPage = perPageParam ? Number(perPageParam) : 15;

    logger.info(`Search request received: q=${query} page=${page} perPage=${perPage}`);

    // Always return paginated object (items, total, page, perPage)
    const result = await bookService.listBooks(query, page, perPage);

    logger.info(`Search results found: ${result.items.length} items (total=${result.total})`);

    return c.json(result);
  } catch (error) {
    const { statusCode, body } = ErrorResponseHandler.generate(error);

    return c.json(body, statusCode);
  }
};

export const listBooks = (bookService: IBookService) => async (c: Context) => {
  try {
    const pageParam = c.req.query('page');
    const perPageParam = c.req.query('per_page') || c.req.query('perPage');

    const page = pageParam ? Number(pageParam) : 1;
    const perPage = perPageParam ? Number(perPageParam) : 15;

    logger.info(`List books request received: page=${page} perPage=${perPage}`);

    const result = await bookService.listAllBooks(page, perPage);

    return c.json(result);
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