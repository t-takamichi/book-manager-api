import { DomainValidationError } from '@web/domain/errors/customErrors';

export type CheckoutOptions = {
  bookId: string;
  borrowerId?: number;
  borrowerName?: string;
  borrowerEmail?: string;
  staffId?: number;
  dueAt?: string;
};

export function buildCheckoutOptionsFromBody(bookId: string, raw: any): CheckoutOptions {
  const body = raw || {};

  const borrowerId =
    body.borrowerId !== undefined && body.borrowerId !== null ? Number(body.borrowerId) : undefined;
  const staffId =
    body.staffId !== undefined && body.staffId !== null ? Number(body.staffId) : undefined;

  const borrowerName = body.borrowerName ? String(body.borrowerName) : undefined;
  const borrowerEmail = body.borrowerEmail ? String(body.borrowerEmail) : undefined;

  let dueAt: string | undefined = undefined;
  if (body.dueAt) {
    const parsed = Date.parse(String(body.dueAt));
    if (isNaN(parsed)) {
      throw new DomainValidationError('dueAt must be a valid date string');
    }
    dueAt = new Date(parsed).toISOString();
  }

  if (!borrowerId && !borrowerName) {
    throw new DomainValidationError('borrowerId or borrowerName is required');
  }

  const options: CheckoutOptions = {
    bookId,
    ...(borrowerId !== undefined ? { borrowerId } : {}),
    ...(borrowerName ? { borrowerName } : {}),
    ...(borrowerEmail ? { borrowerEmail } : {}),
    ...(staffId !== undefined ? { staffId } : {}),
    ...(dueAt ? { dueAt } : {}),
  };

  return options;
}

export default buildCheckoutOptionsFromBody;
