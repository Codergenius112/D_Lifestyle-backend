import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { QueuesService } from './queues.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('queues')
export class QueuesController {
  constructor(private queuesService: QueuesService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async joinQueue(
    @Body() body: { venueId: string },
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.queuesService.joinQueue(body.venueId, user.id, ipAddress);
  }

  @Get('venue/:venueId')
  @Roles(UserRole.CUSTOMER, UserRole.DOOR_STAFF, UserRole.MANAGER)
  async getVenueQueue(@Param('venueId') venueId: string) {
    return this.queuesService.getVenueQueueStatus(venueId);
  }

  @Get('position/:queueId')
  @Roles(UserRole.CUSTOMER)
  async getQueuePosition(@Param('queueId') queueId: string) {
    return this.queuesService.getQueuePosition(queueId);
  }

  @Post(':queueId/checkin')
  @Roles(UserRole.CUSTOMER, UserRole.DOOR_STAFF)
  @HttpCode(200)
  async checkInFromQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.queuesService.checkInFromQueue(queueId, user.id, ipAddress);
  }

  @Post(':queueId/cancel')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async cancelQueue(
    @Param('queueId') queueId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    await this.queuesService.cancelQueueEntry(queueId, user.id, ipAddress);
    return { success: true };
  }
}