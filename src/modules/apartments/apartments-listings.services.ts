import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApartmentListing } from '../../shared/entities/apartment-listing.entity';
import {
  IsString, IsOptional, IsNumber, Min, IsArray, ArrayMinSize, IsBoolean,
} from 'class-validator';

// Was previously a plain interface, which NestJS's ValidationPipe cannot
// validate at all (interfaces are erased at runtime) — the controller took
// `@Body() dto: any`, so apartment listing creation had zero field
// validation. Converted to a real class-validator DTO.
export class CreateApartmentListingDto {
  @IsString() name: string;
  @IsString() description: string;
  @IsString() address: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsNumber() @Min(0) pricePerNight: number;
  @IsNumber() @Min(0) bedrooms: number;
  @IsNumber() @Min(0) bathrooms: number;
  @IsNumber() @Min(1) maxGuests: number;
  @IsOptional() @IsNumber() @Min(0) cautionFee?: number;
  @IsOptional() @IsBoolean() cautionFeeRefundable?: boolean;
  @IsOptional() @IsString() houseRules?: string;
  @IsOptional() @IsArray() amenities?: string[];
  @IsArray() @ArrayMinSize(1, { message: 'At least one image is required' }) images: string[];
  @IsOptional() @IsString() managedBy?: string | null;
}

export class UpdateApartmentListingDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsNumber() @Min(0) pricePerNight?: number;
  @IsOptional() @IsNumber() @Min(0) bedrooms?: number;
  @IsOptional() @IsNumber() @Min(0) bathrooms?: number;
  @IsOptional() @IsNumber() @Min(1) maxGuests?: number;
  @IsOptional() @IsNumber() @Min(0) cautionFee?: number;
  @IsOptional() @IsBoolean() cautionFeeRefundable?: boolean;
  @IsOptional() @IsString() houseRules?: string;
  @IsOptional() @IsArray() amenities?: string[];
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() managedBy?: string | null;
  @IsOptional() isActive?: boolean;
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