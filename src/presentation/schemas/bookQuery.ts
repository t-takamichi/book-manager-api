import { z } from 'zod';

export const BookQuerySchema = z.object(
    {
        q: z.string()
            .min(1, 'Query parameter is required and cannot be empty.')
            .max(40, 'Query parameter is too long. Maximum length is 40 characters.')
            .optional(),
        page: z.string().optional(),
        per_page: z.string().optional(),
    }
);

export type BookQueryParams = z.infer<typeof BookQuerySchema>;
