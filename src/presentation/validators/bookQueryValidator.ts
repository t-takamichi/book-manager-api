import { DomainValidationError } from "@web/domain/errors/customErrors";
import { BookQuerySchema, type BookQueryParams } from "../schemas/bookQuery";

export class BookQueryValidator {
  static parserFromRequest(raw: 
    { q?: string; 
      page?: string;
      per_page?: string; 
    }) : BookQueryParams {

    const merged = {
      q: raw.q,
      page: raw.page,
      per_page: raw.per_page,
    }

    const parsed = BookQuerySchema.safeParse(merged); 
    if (!parsed.success) {
      const msg = parsed.error.issues.map(e => e.message).join(', ');
      throw new DomainValidationError(msg);
    }
    return parsed.data;
  }
}
