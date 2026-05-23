import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarListing } from '../../shared/entities/car-listing.entity';

export interface CreateCarListingDto {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  transmission: string;
  category: string;
  seats: number;
  pricePerDay: number;
  description: string;
  features?: string[];
  images?: string[];
  city: string;
  state: string;
  withDriver?: boolean;
  managedBy?: string;
}

export interface UpdateCarListingDto extends Partial<CreateCarListingDto> {
  isActive?: boolean;
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
}

@Injectable()
export class CarListingsService {
  constructor(
    @InjectRepository(CarListing)
    private listingRepository: Repository<CarListing>,
  ) {}

  /**
   * GET /cars/listings
   * Returns all active car listings with optional filters.
   */
  async getListings(query: GetCarListingsQuery): Promise<{ listings: CarListing[]; total: number }> {
    const qb = this.listingRepository.createQueryBuilder('car')
      .where('car.isActive = :isActive', { isActive: true });

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
  async getListing(id: string): Promise<CarListing> {
    const listing = await this.listingRepository.findOne({
      where: { id, isActive: true },
    });
    if (!listing) {
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
  async updateListing(id: string, dto: UpdateCarListingDto): Promise<CarListing> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    Object.assign(listing, dto);
    return this.listingRepository.save(listing);
  }

  /**
   * DELETE /cars/listings/:id  (admin only) — soft delete via isActive flag
   */
  async deactivateListing(id: string): Promise<{ success: boolean }> {
    const listing = await this.listingRepository.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException(`Car listing ${id} not found`);
    }
    listing.isActive = false;
    await this.listingRepository.save(listing);
    return { success: true };
  }
}