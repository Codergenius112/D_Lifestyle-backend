import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarListing } from '../../shared/entities/car-listing.entity';
import {
  IsString, IsOptional, IsNumber, Min, IsArray, ArrayMinSize, IsBoolean,
} from 'class-validator';

// Was previously a plain interface, which NestJS's ValidationPipe cannot
// validate at all (interfaces are erased at runtime) — the controller took
// `@Body() dto: any`, so car listing creation had zero field validation.
// Converted to a real class-validator DTO.
export class CreateCarListingDto {
  @IsString() make: string;
  @IsString() model: string;
  @IsNumber() year: number;
  @IsString() color: string;
  @IsString() plateNumber: string;
  @IsString() transmission: string;
  @IsString() category: string;
  @IsNumber() @Min(1) seats: number;
  @IsNumber() @Min(0) pricePerDay: number;
  @IsOptional() @IsNumber() @Min(0) cautionFee?: number;
  @IsOptional() @IsBoolean() cautionFeeRefundable?: boolean;
  @IsString() description: string;
  @IsOptional() @IsArray() features?: string[];
  @IsArray() @ArrayMinSize(1, { message: 'At least one image is required' }) images: string[];
  @IsString() city: string;
  @IsString() state: string;
  @IsOptional() @IsBoolean() withDriver?: boolean;
  @IsOptional() @IsString() managedBy?: string | null;
}

export class UpdateCarListingDto {
  @IsOptional() @IsString() make?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsNumber() year?: number;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() plateNumber?: string;
  @IsOptional() @IsString() transmission?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsNumber() @Min(1) seats?: number;
  @IsOptional() @IsNumber() @Min(0) pricePerDay?: number;
  @IsOptional() @IsNumber() @Min(0) cautionFee?: number;
  @IsOptional() @IsBoolean() cautionFeeRefundable?: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() features?: string[];
  @IsOptional() @IsArray() images?: string[];
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsBoolean() withDriver?: boolean;
  @IsOptional() @IsString() managedBy?: string | null;
  @IsOptional() isActive?: boolean;
}

export interface GetCarListingsQuery {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  transmission?: string;
  category?: string;
  withDriver?: boolean;
  limit?: number;
  offset?: number;
  // undefined = no restriction (public catalog / super admin). null =
  // restrict to nothing. Otherwise scope to a specific business owner.
  ownerId?: string | null;
  activeOnly?: boolean;
}

@Injectable()
export class CarListingsService {
  constructor(
    @InjectRepository(CarListing)
    private listingRepository: Repository<CarListing>,
  ) {}

  /**
   * GET /cars/listings
   * Public: all active listings. Staff (ownerId provided): only their own
   * business's listings, active or not.
   */
  async getListings(query: GetCarListingsQuery): Promise<{ listings: CarListing[]; total: number }> {
    if (query.ownerId === null) return { listings: [], total: 0 };

    const qb = this.listingRepository.createQueryBuilder('car');
    if (query.activeOnly !== false) {
      qb.where('car.isActive = :isActive', { isActive: true });
    } else {
      qb.where('1=1');
    }
    if (query.ownerId) {
      qb.andWhere('car."managedBy" = :ownerId', { ownerId: query.ownerId });
    }

    if (query.city) {
      qb.andWhere('LOWER(car.city) LIKE :city', { city: `%${query.city.toLowerCase()}%` });
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('car.pricePerDay >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('car.pricePerDay <= :maxPrice', { maxPrice: query.maxPrice });
    }
    if (query.transmission) {
      qb.andWhere('car.transmission = :transmission', { transmission: query.transmission });
    }
    if (query.category) {
      qb.andWhere('car.category = :category', { category: query.category });
    }
    if (query.withDriver !== undefined) {
      qb.andWhere('car.withDriver = :withDriver', { withDriver: query.withDriver });
    }

    qb.orderBy('car.createdAt', 'DESC')
      .take(query.limit || 20)
      .skip(query.offset || 0);

    const [listings, total] = await qb.getManyAndCount();
    return { listings, total };
  }

  /**
   * GET /cars/listings/:id
   * Returns a single car listing by ID.
   */
  async getListing(id: string, ownerId?: string | null): Promise<CarListing> {
    const listing = await this.listingRepository.findOne({
      where: { id, isActive: true },
    });
    if (!listing) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    return listing;
  }

  /**
   * POST /cars/listings  (admin/manager only)
   */
  async createListing(dto: CreateCarListingDto): Promise<CarListing> {
    const listing = this.listingRepository.create({
      ...dto,
      features: dto.features || [],
      images: dto.images || [],
      withDriver: dto.withDriver || false,
      isActive: true,
    });
    return this.listingRepository.save(listing);
  }

  /**
   * PATCH /cars/listings/:id  (admin/manager only)
   */
  async updateListing(id: string, dto: UpdateCarListingDto, ownerId?: string | null): Promise<CarListing> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    Object.assign(listing, dto);
    return this.listingRepository.save(listing);
  }

  /**
   * DELETE /cars/listings/:id  (admin only) — soft delete via isActive flag
   */
  async deactivateListing(id: string, ownerId?: string | null): Promise<{ success: boolean }> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    if (ownerId !== undefined && listing.managedBy !== ownerId) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    listing.isActive = false;
    await this.listingRepository.save(listing);
    return { success: true };
  }
}