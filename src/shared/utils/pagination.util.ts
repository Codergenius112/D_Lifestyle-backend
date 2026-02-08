export interface PaginationMeta {
  total: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export class PaginationUtil {
  static paginate<T>(
    items: T[],
    page: number,
    perPage: number,
  ): PaginatedResponse<T> {
    const total = items.length;
    const pageCount = Math.ceil(total / perPage);
    const start = (page - 1) * perPage;
    const data = items.slice(start, start + perPage);

    return {
      data,
      meta: {
        total,
        pageCount,
        currentPage: page,
        perPage,
      },
    };
  }

  static getPaginationParams(query: any): [number, number] {
    const page = Math.max(1, parseInt(query.page) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(query.perPage) || 20));

    return [page, perPage];
  }

  static getOffsetLimit(page: number, perPage: number): [number, number] {
    return [(page - 1) * perPage, perPage];
  }
}