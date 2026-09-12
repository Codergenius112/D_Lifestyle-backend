import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from '../../shared/entities/venue.entity';
import { IsString, IsOptional, IsNumber, IsArray, ArrayMinSize } from 'class-validator';
import { BusinessContextService } from '../../shared/services/business-context.service'; // ← NEW (multi-tenancy)

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
    private readonly businessContext: BusinessContextService, // ← NEW (multi-tenancy)
  ) {}

  // ← CHANGED (multi-tenancy): create() now takes an explicit businessId
  // (resolved by the controller from TenantScopeGuard's activeBusinessId)
  // instead of an ownerId. ownerId is still stamped for backward
  // compatibility with any code that still reads it directly, but
  // businessId is now the source of truth for all scoping.
  async create(dto: CreateVenueDto, ownerId: string, businessId?: string | null): Promise<Venue> {
    const venue = this.repo.create({ ...dto, ownerId, businessId: businessId ?? null, allowWalkInOrders: true });
    return this.repo.save(venue);
  }

  // businessIds: undefined = no restriction (customers browsing, or super
  // admin oversight). [] = restrict to nothing (caller has no accessible
  // business). Otherwise, restrict to those specific business(es) — this is
  // what lets one owner's several businesses stay isolated from each other.
  async findAll(params?: {
    city?: string; category?: string; limit?: number; offset?: number;
    activeOnly?: boolean; businessIds?: string[];
  }) {
    if (params?.businessIds && params.businessIds.length === 0) return { data: [], total: 0 };

    const qb = this.repo.createQueryBuilder('v').where('v.isDeleted = false');
    if (params?.activeOnly) qb.andWhere('v.isActive = true');
    if (params?.city) qb.andWhere('v.city = :city', { city: params.city });
    if (params?.category) qb.andWhere('v.category = :category', { category: params.category });
    if (params?.businessIds) qb.andWhere('v."businessId" IN (:...businessIds)', { businessIds: params.businessIds });
    qb.take(params?.limit ?? 50).skip(params?.offset ?? 0);
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, businessIds?: string[]): Promise<Venue> {
    const venue = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!venue) throw new NotFoundException('Venue not found');
    if (businessIds !== undefined && (!businessIds.length || !businessIds.includes((venue as any).businessId))) {
      throw new NotFoundException('Venue not found');
    }
    return venue;
  }

  async update(id: string, dto: UpdateVenueDto, businessIds?: string[]): Promise<Venue> {
    const venue = await this.findOne(id, businessIds);
    // ← NEW (multi-tenancy) — close the suspension-freeze gap: block edits
    // to a venue whose business is suspended, not just its bookings.
    await this.businessContext.assertBusinessActive((venue as any).businessId);
    Object.assign(venue, dto);
    return this.repo.save(venue);
  }

  async softDelete(id: string, businessIds?: string[]): Promise<void> {
    const venue = await this.findOne(id, businessIds);
    await this.businessContext.assertBusinessActive((venue as any).businessId);
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
    businessIds?: string[],
  ): Promise<Venue> {
    void ownerId; // legacy param kept for call-site compatibility; businessIds now drives scoping
    const venue = await this.findOne(id, businessIds);
    await this.businessContext.assertBusinessActive((venue as any).businessId);
    venue.hasFloorPlan = floorPlanData.hasFloorPlan;
    venue.floorPlanData = floorPlanData.floorPlanData as any;
    return this.repo.save(venue);
  }
}
