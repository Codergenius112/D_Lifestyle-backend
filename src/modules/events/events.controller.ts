import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { TenantScopeGuard } from '../../common/guards/tenant-scope.guard'; // ← NEW (multi-tenancy)
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { BusinessIds, ActiveBusinessId, ActiveBusinessScopes } from '../../common/decorators/business-context.decorator'; // ← CHANGED (scope fix)
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from '../../shared/dtos/event.dto';
import { UserRole, BusinessScope }     from '../../shared/enums';
import { effectiveOwnerId, hasBusinessScope } from '../../shared/utils/business-scope.util';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * POST /events — admin/manager only. Owned by the caller's own business.
   * ← CHANGED (scope fix): now requires the TARGET business to actually
   * have EVENT_TICKETING in its own Business.businessScopes — previously
   * unchecked entirely. This is also what makes "same business runs both
   * a venue and an event" work with zero extra setup: give one business
   * both TABLE_CLUB and EVENT_TICKETING (multi-scope-per-business), and
   * its staff/inventory/data are automatically shared, since it's the
   * same businessId — no BusinessDataShare needed for that case.
   */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createEvent(
    @Body() dto: CreateEventDto, @CurrentUser() user: any,
    @ActiveBusinessId() activeBusinessId?: string | null,
    @ActiveBusinessScopes() activeBusinessScopes?: BusinessScope[],
  ) {
    if (!activeBusinessId) {
      throw new BadRequestException(
        'Could not determine which business this event belongs to. If you manage more than one business, specify one via the X-Business-Id header.',
      );
    }
    if (!hasBusinessScope({ role: user.role, businessScopes: activeBusinessScopes }, BusinessScope.EVENT_TICKETING)) {
      throw new ForbiddenException('This business is not set up for event ticketing — ask a super admin to add the scope.');
    }
    return this.eventsService.createEvent({ ...(dto as any), ownerId: effectiveOwnerId(user), businessId: activeBusinessId });
  }

  /**
   * GET /events?limit=50&offset=0&status=active&venueId=xxx
   * Public — unauthenticated, unscoped by design. Frontend calls this on
   * Home and Discover screens; every customer should see every event.
   */
  @Get()
  async getAllEvents(
    @Query('limit')   limit?:   string,
    @Query('offset')  offset?:  string,
    @Query('status')  status?:  string,
    @Query('venueId') venueId?: string,
  ) {
    return this.eventsService.getAllEvents(
      limit   ? parseInt(limit,  10) : 50,
      offset  ? parseInt(offset, 10) : 0,
      status,
      venueId,
    );
  }

  /**
   * GET /events/mine — staff dashboard listing, scoped to the caller's own
   * business(es) unless super admin. Deliberately a separate route from the
   * public GET / above so ownership scoping never touches public browsing.
   * Must be declared before GET /:id so 'mine' isn't parsed as an id.
   */
  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getMyEvents(
    @CurrentUser() user: any,
    @Query('limit')  limit?:  string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @BusinessIds() businessIds?: string[], // ← CHANGED (multi-tenancy)
  ) {
    return this.eventsService.getEventsForOwner(
      limit  ? parseInt(limit,  10) : 50,
      offset ? parseInt(offset, 10) : 0,
      status,
      businessIds,
    );
  }

  /**
   * GET /events/:id — public
   */
  @Get(':id')
  async getEvent(@Param('id') eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  /**
   * PATCH /events/:id — admin/manager only, within one of the caller's own business(es)
   */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateEvent(@Param('id') eventId: string, @Body() dto: UpdateEventDto, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    return this.eventsService.updateEvent(eventId, dto as any, businessIds);
  }

  /**
   * DELETE /events/:id — admin only, within one of the caller's own business(es)
   */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantScopeGuard, RolesGuard) // ← CHANGED (multi-tenancy)
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async deleteEvent(@Param('id') eventId: string, @CurrentUser() user: any, @BusinessIds() businessIds?: string[]) {
    await this.eventsService.deleteEvent(eventId, businessIds);
  }
}
