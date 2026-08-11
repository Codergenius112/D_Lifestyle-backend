import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { CurrentUser }  from '../../common/decorators/current-user.decorator';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from '../../shared/dtos/event.dto';
import { UserRole }     from '../../shared/enums';
import { effectiveOwnerId } from '../../shared/utils/business-scope.util';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * POST /events — admin/manager only. Owned by the caller's own business.
   */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createEvent(@Body() dto: CreateEventDto, @CurrentUser() user: any) {
    return this.eventsService.createEvent({ ...(dto as any), ownerId: effectiveOwnerId(user) });
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
   * business unless super admin. Deliberately a separate route from the
   * public GET / above so ownership scoping never touches public browsing.
   * Must be declared before GET /:id so 'mine' isn't parsed as an id.
   */
  @Get('mine')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN)
  async getMyEvents(
    @CurrentUser() user: any,
    @Query('limit')  limit?:  string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
  ) {
    return this.eventsService.getEventsForOwner(
      limit  ? parseInt(limit,  10) : 50,
      offset ? parseInt(offset, 10) : 0,
      status,
      effectiveOwnerId(user),
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
   * PATCH /events/:id — admin/manager only, within the caller's own business
   */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateEvent(@Param('id') eventId: string, @Body() dto: UpdateEventDto, @CurrentUser() user: any) {
    return this.eventsService.updateEvent(eventId, dto as any, effectiveOwnerId(user));
  }

  /**
   * DELETE /events/:id — admin only, within the caller's own business
   */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async deleteEvent(@Param('id') eventId: string, @CurrentUser() user: any) {
    await this.eventsService.deleteEvent(eventId, effectiveOwnerId(user));
  }
}
