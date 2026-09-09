import { z } from "zod";

/**
 * Shared list-endpoint pagination. `meta` shape matches PROJECT_PLAN.md
 * Sec 2.4 ("meta carries pagination for list endpoints").
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  skip: number;
  take: number;
} {
  const { page, limit } = paginationSchema.parse({
    page: searchParams.get("page") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
