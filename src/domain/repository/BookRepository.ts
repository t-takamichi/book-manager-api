import { Book } from '@web/domain/model/Book';

export interface BookRepository {
  findAll(): Promise<Book[]>;

  findByQuery(query?: string): Promise<Book[]>;

  findById(id: string): Promise<Book | null>;

  createLoanForBook(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }): Promise<void>;

  returnBookByBookId(bookId: string): Promise<void>;
}