import { BookQueryValidator } from './bookQueryValidator';

describe('BookQueryValidator', () => {
  test('should pass validation for a valid query', () => {
    expect(() => BookQueryValidator.validateQuery('valid query')).not.toThrow();
  });

  test('should throw an error for an empty query', () => {
    expect(() => BookQueryValidator.validateQuery('')).toThrow(
      'Query parameter is required and cannot be empty.',
    );
  });

  test('should throw an error for a query that is too long', () => {
    const longQuery = 'a'.repeat(101);
    expect(() => BookQueryValidator.validateQuery(longQuery)).toThrow(
      'Query parameter is too long. Maximum length is 100 characters.',
    );
  });

  test('should throw an error for an undefined query', () => {
    expect(() => BookQueryValidator.validateQuery(undefined)).toThrow(
      'Query parameter is required and cannot be empty.',
    );
  });
});
