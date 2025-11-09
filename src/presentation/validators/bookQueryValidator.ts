export class BookQueryValidator {
  static validateQuery(query: string | undefined): void {
    if (!query || query.trim() === '') {
      throw new Error('Query parameter is required and cannot be empty.');
    }

    if (query.length > 100) {
      throw new Error('Query parameter is too long. Maximum length is 100 characters.');
    }
  }
}