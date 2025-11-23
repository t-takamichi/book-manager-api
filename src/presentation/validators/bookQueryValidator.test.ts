import { BookQueryValidator } from './bookQueryValidator';

describe('BookQueryValidator', () => {
	test('parses missing params into undefined q and optional fields', () => {
		const parsed = BookQueryValidator.parserFromRequest({});
		expect(parsed).toBeDefined();
		expect(parsed.q).toBeUndefined();
		expect(parsed.page).toBeUndefined();
		expect(parsed.per_page).toBeUndefined();
	});

});
