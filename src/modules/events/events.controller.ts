import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { EventsService } from './events.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createEvent(@Body() createEventDto: any) {
    return this.eventsService.createEvent(createEventDto);
  }

  @Get()
  async getAllEvents(@Body() query: any) {
    return this.eventsService.getAllEvents(query.limit || 50, query.offset || 0);
  }

  @Get(':id')
  async getEvent(@Param('id') eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(200)
  async updateEvent(@Param('id') eventId: string, @Body() updateEventDto: any) {
    return this.eventsService.updateEvent(eventId, updateEventDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(204)
  async deleteEvent(@Param('id') eventId: string) {
    await this.eventsService.deleteEvent(eventId);
  }
}
