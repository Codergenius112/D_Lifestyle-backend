import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface OwnedResourceIds {
  tableListingIds: string[];   // Booking.resourceId for bookingType = 'table'
  apartmentListingIds: string[]; // bookingType = 'apartment'
  carListingIds: string[];     // bookingType = 'car'
  eventIds: string[];          // bookingType = 'ticket' (resourceId = eventId directly)
  venueIds: string[];          // Order.venueId references venues directly (manual purchases with no table)
}

/**
 * Booking.resourceId is a polymorphic reference — its target table depends
 * on bookingType, so there's no single SQL join that can scope bookings by
 * owner directly. This resolves, for a given business owner, every
 * resource id they control across all four booking types, so callers can
 * build a `(bookingType = X AND resourceId IN (...)) OR ...` condition.
 *
 * Table listings can belong to a venue OR an event (event-scoped tables),
 * so they're resolved via both paths.
 */
@Injectable()
export class OwnershipResolverService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getOwnedResourceIds(ownerId: string): Promise<OwnedResourceIds> {
    const [tableRows, aptRows, carRows, eventRows, venueRows] = await Promise.all([
      this.dataSource.query(
        `SELECT tl.id FROM table_listings tl
         LEFT JOIN venues v ON v.id = tl."venueId"
         LEFT JOIN events e ON e.id = tl."eventId"
         WHERE v."ownerId" = $1 OR e."ownerId" = $1`,
        [ownerId],
      ),
      this.dataSource.query(
        `SELECT id FROM apartment_listings WHERE "managedBy" = $1`,
        [ownerId],
      ),
      this.dataSource.query(
        `SELECT id FROM car_listings WHERE "managedBy" = $1`,
        [ownerId],
      ),
      this.dataSource.query(
        `SELECT id FROM events WHERE "ownerId" = $1`,
        [ownerId],
      ),
      this.dataSource.query(
        `SELECT id FROM venues WHERE "ownerId" = $1`,
        [ownerId],
      ),
    ]);

    return {
      tableListingIds:     tableRows.map((r: any) => r.id),
      apartmentListingIds: aptRows.map((r: any) => r.id),
      carListingIds:       carRows.map((r: any) => r.id),
      eventIds:            eventRows.map((r: any) => r.id),
      venueIds:            venueRows.map((r: any) => r.id),
    };
  }
}
