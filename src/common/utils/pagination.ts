export type NormalizedPagination = {
  search?: string;
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: "asc" | "desc";
};

type RawPaginationLike = {
  page?: unknown;
  limit?: unknown;
  sortBy?: unknown;
  sortOrder?: unknown;
  search?: unknown;
};

function asPaginationLike(query: unknown): RawPaginationLike {
  if (query && typeof query === "object") {
    return query as RawPaginationLike;
  }

  return {};
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function toSortOrder(value: unknown): "asc" | "desc" {
  return value === "asc" ? "asc" : "desc";
}

export function normalizePagination(
  rawQuery: unknown,
  allowedSortFields: readonly string[],
  options?: { defaultSortBy?: string; defaultLimit?: number; maxLimit?: number }
): NormalizedPagination {
  const query = asPaginationLike(rawQuery);
  const defaultLimit = options?.defaultLimit ?? 50;
  const maxLimit = options?.maxLimit ?? 500;
  const page = toPositiveInteger(query.page, 1);
  const rawLimit = toPositiveInteger(query.limit, defaultLimit);
  const limit = Math.min(rawLimit, maxLimit);
  const defaultSortBy = options?.defaultSortBy ?? "created_at";
  const requestedSortBy = typeof query.sortBy === "string" ? query.sortBy : defaultSortBy;
  const sortBy = allowedSortFields.includes(requestedSortBy) ? requestedSortBy : defaultSortBy;
  const sortOrder = toSortOrder(query.sortOrder);
  const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined;

  return {
    search,
    page,
    limit,
    skip: (page - 1) * limit,
    sortBy,
    sortOrder
  };
}
