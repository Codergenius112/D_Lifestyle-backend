import { Controller, Post, Get, Patch, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IpAddress } from '../../common/decorators/ip-address.decorator';
import { TicketsService } from './tickets.service';
import { UserRole } from '../../shared/enums';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  @Roles(UserRole.CUSTOMER)
  @HttpCode(201)
  async createTicket(
    @Body() createTicketDto: any,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.ticketsService.createTicket(user.id, createTicketDto, ipAddress);
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  async getMyTickets(
    @CurrentUser() user: any,
    @Body() query: any,
  ) {
    const [tickets, total] = await this.ticketsService.getUserTickets(
      user.id,
      query.limit || 20,
      query.offset || 0,
    );
    return { tickets, total };
  }

  @Get(':id')
  @Roles(UserRole.CUSTOMER)
  async getTicket(@Param('id') ticketId: string) {
    return this.ticketsService.getTicket(ticketId);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CUSTOMER)
  @HttpCode(200)
  async cancelTicket(
    @Param('id') ticketId: string,
    @CurrentUser() user: any,
    @IpAddress() ipAddress: string,
  ) {
    return this.ticketsService.cancelTicket(ticketId, user.id, ipAddress);
  }
}