import { BookService } from './BookService';
import { NotFoundError } from '@web/domain/errors/customErrors';

describe('BookService', () => {
  test('throws domain validation error when query is too short', () => {
    const repo: any = { findByQuery: jest.fn() };
    const svc = new BookService(repo);

    // searchBooks is now async and validates before calling repository
    return expect(svc.searchBooks('ab'))
      .rejects.toThrow(/at least 3 characters/)
      .then(() => {
        expect(repo.findByQuery).not.toHaveBeenCalled();
      });
  });

  test('returns results when repository has matches', () => {
    const sample = [{ id: '1', title: 'TypeScript入門' }];
    const repo: any = { findByQuery: jest.fn().mockResolvedValue(sample) };
    const svc = new BookService(repo);

    return svc.searchBooks('TypeScript').then((results) => {
      expect(results).toBe(sample);
      expect(repo.findByQuery).toHaveBeenCalledWith('TypeScript');
    });
  });

  test('throws NotFoundError when repository returns no results', () => {
    const repo: any = { findByQuery: jest.fn().mockResolvedValue([]) };
    const svc = new BookService(repo);

    return expect(svc.searchBooks('unknown query'))
      .rejects.toThrow(NotFoundError)
      .then(() => {
        expect(repo.findByQuery).toHaveBeenCalledWith('unknown query');
      });
  });

  test('listAllBooks normalizes page/perPage defaults and returns shaped response', async () => {
    const sample = [{ id: '1', title: 'A' }];
    const repo: any = { findPaginated: jest.fn().mockResolvedValue({ items: sample, total: 1 }) };
    const svc = new BookService(repo);

    const res = await svc.listAllBooks();

    expect(repo.findPaginated).toHaveBeenCalledWith(1, 15);
    expect(res.items).toBe(sample);
    expect(res.total).toBe(1);
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(15);
  });

  test('listAllBooks clamps perPage > 100 and normalizes invalid page/perPage', async () => {
    const sample = [{ id: '2', title: 'B' }];
    const repo: any = { findPaginated: jest.fn().mockResolvedValue({ items: sample, total: 10 }) };
    const svc = new BookService(repo);

    // perPage too large should be clamped to 100, page 0 should become 1
    const res = await svc.listAllBooks(0, 1000);

    expect(repo.findPaginated).toHaveBeenCalledWith(1, 100);
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(100);
    expect(res.total).toBe(10);
  });

  test('listBooks with query normalizes page/perPage and passes query to repository', async () => {
    const sample = [{ id: '3', title: 'C' }];
    const repo: any = {
      findByQueryPaginated: jest.fn().mockResolvedValue({ items: sample, total: 3 }),
    };
    const svc = new BookService(repo);

  const res = await svc.listBooks({ query: 'search', page: -5, perPage: 2000 });

    // negative page should be normalized to 1, perPage clamped to 100
    expect(repo.findByQueryPaginated).toHaveBeenCalledWith('search', 1, 100);
    expect(res.page).toBe(1);
    expect(res.perPage).toBe(100);
    expect(res.total).toBe(3);
    expect(res.items).toBe(sample);
  });
});
