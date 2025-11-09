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
    // borrowerId or borrowerName required is already checked at handler level,
    // but validate here as well for service callers.
    if (!options.borrowerId && !options.borrowerName) {
      throw new DomainValidationError('borrowerId or borrowerName is required');
    }

    // staffId must be present and numeric
    if (options.staffId === undefined || options.staffId === null) {
      throw new DomainValidationError('staffId is required');
    }
    if (typeof options.staffId !== 'number' || !Number.isInteger(options.staffId)) {
      throw new DomainValidationError('staffId must be an integer');
    }

    // dueAt, if provided, must be a valid date and not in the past
    if (options.dueAt) {
      const parsed = new Date(options.dueAt);
      if (Number.isNaN(parsed.getTime())) {
        throw new DomainValidationError('dueAt must be a valid date');
      }

      // compare date-only (YYYY-MM-DD)
      const due = new Date(parsed.toISOString().slice(0, 10));
      const today = new Date(new Date().toISOString().slice(0, 10));
      if (due < today) {
        throw new DomainValidationError('dueAt cannot be in the past');
      }
    }
  },
};

export default CheckoutValidator;
