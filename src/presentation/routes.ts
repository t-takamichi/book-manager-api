import { Hono } from 'hono';
import { searchBooks, getBookById, checkoutBook, returnBook } from '@web/presentation/handlers/book.handler';
import type { IBookService } from '@web/domain/service/BookService';

export const createRoutes = (bookService: IBookService) => {
  const app = new Hono();

  app.get('/api/books', searchBooks(bookService));
  app.get('/api/books/:id', getBookById(bookService));
  app.post('/api/books/:id/checkout', checkoutBook(bookService));
  app.post('/api/books/:id/return', returnBook(bookService));

  return app;
};