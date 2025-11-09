import { Hono } from 'hono';
import { searchBooks, getBookById, checkoutBook, returnBook } from '../presentation/handlers/book.handler.js';
export const createRoutes = (bookService) => {
    const app = new Hono();
    app.get('/api/books', searchBooks(bookService));
    app.get('/api/books/:id', getBookById(bookService));
    app.post('/api/books/:id/checkout', checkoutBook(bookService));
    app.post('/api/books/:id/return', returnBook(bookService));
    return app;
};
