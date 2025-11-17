import { DomainValidationError } from '@web/domain/errors/customErrors';

export const CheckoutValidator = {
  validate(options: {
    bookId: string;
    borrowerId?: number;
    borrowerName?: string;
    borrowerEmail?: string;
    staffId?: number;
    dueAt?: string;
  }) {
    if (!options.borrowerId && !options.borrowerName) {
      throw new DomainValidationError('borrowerId or borrowerName is required');
    }

    if (options.staffId === undefined || options.staffId === null) {
      throw new DomainValidationError('staffId is required');
    }
    if (typeof options.staffId !== 'number' || !Number.isInteger(options.staffId)) {
      throw new DomainValidationError('staffId must be an integer');
    }

    if (options.dueAt) {
      const parsed = new Date(options.dueAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new DomainValidationError('dueAt must be a valid date');
      }

      const due = new Date(parsed.toISOString().slice(0, 10));
      const today = new Date(new Date().toISOString().slice(0, 10));
      if (due < today) {
        throw new DomainValidationError('dueAt cannot be in the past');
      }
    }
  },
};

export default CheckoutValidator;
