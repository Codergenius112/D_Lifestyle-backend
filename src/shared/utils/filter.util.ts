export interface FilterOptions {
  status?: string;
  bookingType?: string;
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  minAmount?: number;
  maxAmount?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export class FilterUtil {
  static buildWhereClause(filters: FilterOptions): Record<string, any> {
    const where: Record<string, any> = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.bookingType) {
      where.bookingType = filters.bookingType;
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters.minAmount || filters.maxAmount) {
      where.basePrice = {};
      if (filters.minAmount) {
        where.basePrice.gte = filters.minAmount;
      }
      if (filters.maxAmount) {
        where.basePrice.lte = filters.maxAmount;
      }
    }

    return where;
  }

  static getSortOption(sortBy?: string, sortOrder: 'ASC' | 'DESC' = 'DESC'): Record<string, any> {
    const allowedFields = ['createdAt', 'updatedAt', 'basePrice', 'totalAmount', 'status'];
    const field = allowedFields.includes(sortBy) ? sortBy : 'createdAt';

    return {
      [field]: sortOrder,
    };
  }
}
