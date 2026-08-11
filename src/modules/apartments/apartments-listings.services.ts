import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApartmentListing } from '../../shared/entities/apartment-listing.entity';

export interface CreateApartmentListingDto {
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  pricePerNight: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  amenities?: string[];
  images?: string[];
  managedBy?: string;
}

export interface UpdateApartmentListingDto extends Partial<CreateApartmentListingDto> {
  isActive?: boolean;
}

export interface GetApartmentListingsQuery {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  limit?: number;
  offset?: number;
  // undefined = no restriction (public catalog / super admin). null =
  // restrict to nothing. Otherwise scope to a specific business owner.
  ownerId?: string | null;
  activeOnly?: boolean;
}

@Injectable()
export class ApartmentListingsService {
  constructor(
    @InjectRepository(ApartmentListing)
    private listingRepository: Repository<ApartmentListing>,
  ) {}

  /**
   * GET /apartments/listings
   * Public: all active listings. Staff (ownerId provided): only their own
   * business's listings, active or not.
   */
  async getListings(query: GetApartmentListingsQuery): Promise<{ listings: ApartmentListing[]; total: number }> {
    if (query.ownerId === null) return { listings: [], total: 0 };

    const qb = this.listingRepository.createQueryBuilder('listing');
    if (query.activeOnly !== false) {
      qb.where('listing.isActive = :isActive', { isActive: true });
    } else {
      qb.where('1=1');
    }
    if (query.ownerId) {
      qb.andWhere('listing."managedBy" = :ownerId', { ownerId: query.ownerId });
    }

    if (query.city) {
      qb.andWhere('LOWER(listing.city) LIKE :city', { city: `%${query.city.toLowerCase()}%` });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('listing.pricePerNight >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('listing.pricePerNight <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.bedrooms !== undefined) {
      qb.andWhere('listing.bedrooms >= :bedrooms', { bedrooms: query.bedrooms });
    }

    qb.orderBy('listing.createdAt', 'DESC')
      .take(query.limit || 20)
      .skip(query.offset || 0);

    const [listings, total] = await qb.getManyAndCount();
    return { listings, total };
  }

  /**
   * GET /apartments/listings/:id
   * Returns a single listing by ID.
   */
  async getListing(id: string, ownerId?: string | null): Promise<ApartmentListing> {
    const listing = await this.listingRepository.findOne({
      where: { id, isActive: true },
    });
    if (!listing) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    return listing;
  }

  /**
   * POST /apartments/listings  (admin/manager only)
   */
  async createListing(dto: CreateApartmentListingDto): Promise<ApartmentListing> {
    const listing = this.listingRepository.create({
      ...dto,
      amenities: dto.amenities || [],
      images: dto.images || [],
      isActive: true,
    });
    return this.listingRepository.save(listing);
  }

  /**
   * PATCH /apartments/listings/:id  (admin/manager only)
   */
  async updateListing(id: string, dto: UpdateApartmentListingDto, ownerId?: string | null): Promise<ApartmentListing> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    Object.assign(listing, dto);
    return this.listingRepository.save(listing);
  }

  /**
   * DELETE /apartments/listings/:id  (admin only) — soft delete via isActive flag
   */
  async deactivateListing(id: string, ownerId?: string | null): Promise<{ success: boolean }> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Apartment listing ${id} not found`);
    }
    listing.isActive = false;
    await this.listingRepository.save(listing);
    return { success: true };
  }
}