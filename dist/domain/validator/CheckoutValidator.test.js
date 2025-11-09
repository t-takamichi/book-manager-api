import { CheckoutValidator } from './CheckoutValidator.js';
import { DomainValidationError } from '../../domain/errors/customErrors.js';
describe('CheckoutValidator', () => {
    test('throws when borrower info missing', () => {
        expect(() => CheckoutValidator.validate({ bookId: '1' })).toThrow(DomainValidationError);
    });
    test('throws when staffId missing', () => {
        expect(() => CheckoutValidator.validate({ bookId: '1', borrowerName: 'A' })).toThrow(DomainValidationError);
    });
    test('throws when dueAt is past', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        expect(() => CheckoutValidator.validate({ bookId: '1', borrowerName: 'A', staffId: 1, dueAt: yesterday })).toThrow(DomainValidationError);
    });
    test('accepts today dueAt', () => {
        const today = new Date().toISOString().slice(0, 10);
        expect(() => CheckoutValidator.validate({ bookId: '1', borrowerName: 'A', staffId: 1, dueAt: today })).not.toThrow();
    });
});
