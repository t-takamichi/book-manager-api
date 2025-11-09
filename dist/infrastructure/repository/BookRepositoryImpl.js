import { Book } from '../../domain/model/Book.js';
// Sample data lives in the infrastructure layer now
const sampleBooks = [
    new Book('1', 'TypeScript入門', '山田太郎', '978-4-xxxx-xxxx-1', '2025-01-01', 'TypeScriptの基礎から応用まで学べる入門書'),
    new Book('2', 'Honoで作るWebアプリケーション', '鈴木花子', '978-4-xxxx-xxxx-2', '2025-02-15', 'Honoを使ったモダンなWebアプリケーション開発の解説'),
];
export class BookRepositoryImpl {
    async findAll() {
        return sampleBooks;
    }
    async findByQuery(query) {
        if (!query)
            return this.findAll();
        const q = query.toLowerCase();
        const results = sampleBooks.filter((book) => book.title.toLowerCase().includes(q) ||
            book.author.toLowerCase().includes(q) ||
            (book.description && book.description.toLowerCase().includes(q)));
        return results;
    }
    async findById(id) {
        const b = sampleBooks.find((s) => s.id === id);
        return b || null;
    }
}
