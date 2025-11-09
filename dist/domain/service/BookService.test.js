import { BookService } from './BookService.js';
import { NotFoundError } from '../../domain/errors/customErrors.js';
describe('BookService', () => {
    test('throws domain validation error when query is too short', () => {
        const repo = { findByQuery: jest.fn() };
        const svc = new BookService(repo);
        // searchBooks is now async and validates before calling repository
        return expect(svc.searchBooks('ab')).rejects.toThrow(/at least 3 characters/).then(() => {
            expect(repo.findByQuery).not.toHaveBeenCalled();
        });
    });
    test('returns results when repository has matches', () => {
        const sample = [{ id: '1', title: 'TypeScript入門' }];
        const repo = { findByQuery: jest.fn().mockResolvedValue(sample) };
        const svc = new BookService(repo);
        return svc.searchBooks('TypeScript').then((results) => {
            expect(results).toBe(sample);
            expect(repo.findByQuery).toHaveBeenCalledWith('TypeScript');
        });
    });
    test('throws NotFoundError when repository returns no results', () => {
        const repo = { findByQuery: jest.fn().mockResolvedValue([]) };
        const svc = new BookService(repo);
        return expect(svc.searchBooks('unknown query')).rejects.toThrow(NotFoundError).then(() => {
            expect(repo.findByQuery).toHaveBeenCalledWith('unknown query');
        });
    });
});
