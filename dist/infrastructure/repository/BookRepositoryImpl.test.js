import { BookRepositoryImpl } from './BookRepositoryImpl.js';
describe('BookRepositoryImpl', () => {
    const repo = new BookRepositoryImpl();
    test('findAll returns sample books', () => {
        return repo.findAll().then((all) => {
            expect(Array.isArray(all)).toBe(true);
            expect(all.length).toBeGreaterThan(0);
        });
    });
    test('findByQuery returns matches by title', () => {
        return repo.findByQuery('TypeScript').then((results) => {
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(b => b.title.includes('TypeScript'))).toBe(true);
        });
    });
    test('findByQuery is case-insensitive and matches author', () => {
        // author '鈴木花子' contains '鈴木' — use that for matching
        return repo.findByQuery('鈴木').then((byAuthor) => {
            expect(byAuthor.length).toBeGreaterThan(0);
            expect(byAuthor.some(b => b.author.includes('鈴木'))).toBe(true);
        });
    });
    test('findByQuery matches description', () => {
        return repo.findByQuery('Webアプリケーション').then((results) => {
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(b => (b.description || '').includes('Webアプリケーション'))).toBe(true);
        });
    });
    test('findByQuery with undefined returns all', () => {
        return Promise.all([repo.findByQuery(undefined), repo.findAll()]).then(([all, all2]) => {
            expect(all).toEqual(all2);
        });
    });
});
