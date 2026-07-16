import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ItineraryService } from './itinerary.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Itinerary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('itinerary')
export class ItineraryController {
  constructor(private itineraryService: ItineraryService) {}

  /**
   * GET /itinerary
   * Auto-compiled from the user's own active bookings + live queue entries —
   * there's no separate "itinerary" the user builds by hand. Book a ride, a
   * stay, an event, a table, or join a queue, and it shows up here
   * automatically, sorted chronologically. Book only some of those and only
   * those show up — nothing is invented for the ones you didn't book.
   */
  @Get()
  @Roles(UserRole.CUSTOMER)
  async getMyItinerary(@CurrentUser() user: any) {
    const items = await this.itineraryService.getUserItinerary(user.id);
    return { items, total: items.length };
  }
}
