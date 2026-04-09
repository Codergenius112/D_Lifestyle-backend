import {
  Controller, Post, Get, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard }   from '../../common/guards/roles.guard';
import { Roles }        from '../../common/decorators/roles.decorator';
import { EventsService } from './events.service';
import { UserRole }     from '../../shared/enums';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * POST /events — admin/manager only
   */
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createEvent(@Body() dto: any) {
    return this.eventsService.createEvent(dto);
  }

  /**
   * GET /events?limit=50&offset=0&status=active&venueId=xxx
   * Public — frontend calls this on Home and Discover screens
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
   * GET /events/:id — public
   */
  @Get(':id')
  async getEvent(@Param('id') eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  /**
   * PATCH /events/:id — admin/manager only
   */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  async updateEvent(@Param('id') eventId: string, @Body() dto: any) {
    return this.eventsService.updateEvent(eventId, dto);
  }

  /**
   * DELETE /events/:id — admin only
   */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(204)
  async deleteEvent(@Param('id') eventId: string) {
    await this.eventsService.deleteEvent(eventId);
  }
}