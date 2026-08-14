import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../../shared/entities/venue.entity';
import { IsString, IsOptional, IsNumber, IsArray, ArrayMinSize } from 'class-validator';

export class CreateVenueDto {
  @IsString() name: string;
  @IsString() address: string;
  @IsString() city: string;
  @IsNumber() maxCapacity: number;
  @IsArray() @ArrayMinSize(1, { message: 'At least one image is required' }) mediaUrls: string[];
}

export class UpdateVenueDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() maxCapacity?: number;
  @IsOptional() @IsArray() mediaUrls?: string[];
  @IsOptional() isActive?: boolean;
  @IsOptional() allowWalkInOrders?: boolean;
}

@Injectable()
export class VenueService {
  constructor(
    @InjectRepository(Venue)
    private readonly repo: Repository<Venue>,
  ) {}

  async create(dto: CreateVenueDto, ownerId: string): Promise<Venue> {
    const venue = this.repo.create({ ...dto, ownerId, allowWalkInOrders: true });
    return this.repo.save(venue);
  }

  // ownerId: undefined = no restriction (customers browsing, or super admin
  // oversight). null = restrict to nothing (staff with no linked business).
  // Otherwise, restrict to that specific business owner's venues.
  async findAll(params?: {
    city?: string; category?: string; limit?: number; offset?: number;
    activeOnly?: boolean; ownerId?: string | null;
  }) {
    if (params?.ownerId === null) return { data: [], total: 0 };

    const qb = this.repo.createQueryBuilder('v').where('v.isDeleted = false');
    if (params?.activeOnly) qb.andWhere('v.isActive = true');
    if (params?.city) qb.andWhere('v.city = :city', { city: params.city });
    if (params?.category) qb.andWhere('v.category = :category', { category: params.category });
    if (params?.ownerId) qb.andWhere('v."ownerId" = :ownerId', { ownerId: params.ownerId });
    qb.take(params?.limit ?? 50).skip(params?.offset ?? 0);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, ownerId?: string | null): Promise<Venue> {
    const venue = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (ownerId !== undefined && venue.ownerId !== ownerId) {
      throw new NotFoundException('Venue not found');
    }
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto, ownerId?: string | null): Promise<Venue> {
    const venue = await this.findOne(id, ownerId);
    Object.assign(venue, dto);
    return this.repo.save(venue);
  }

  async softDelete(id: string, ownerId?: string | null): Promise<void> {
    const venue = await this.findOne(id, ownerId);
    venue.isDeleted = true;
    await this.repo.save(venue);
  }

  async updateFloorPlan(
    id: string,
    floorPlanData: {
      hasFloorPlan: boolean;
      floorPlanData?: {
        width: number;
        height: number;
        backgroundImage?: string;
        tables: Array<{
          tableId: string;
          x: number;
          y: number;
          rotation: number;
          width: number;
          height: number;
        }>;
      };
    },
    ownerId?: string | null,
  ): Promise<Venue> {
    const venue = await this.findOne(id, ownerId);
    venue.hasFloorPlan = floorPlanData.hasFloorPlan;
    venue.floorPlanData = floorPlanData.floorPlanData as any;
    return this.repo.save(venue);
  }
}
