import { IsArray, IsNumber, IsOptional, IsString, IsUUID, IsPositive, IsEnum } from 'class-validator';

export class OrderItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  name: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class CreateOrderDto {
  @IsUUID()
  bookingId: string;

  @IsArray()
  items: OrderItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AssignOrderToWaiterDto {
  @IsUUID()
  waiterId: string;
}

export class RouteOrderToStationDto {
  @IsUUID()
  stationId: string;
}

export class UpdateOrderStatusDto {
  @IsEnum([
    'ASSIGNED',
    'ROUTED',
    'IN_PREPARATION',
    'READY',
    'SERVED',
    'COMPLETED',
    'CANCELLED',
  ])
  status: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class OrderResponseDto {
  id: string;
  bookingId: string;
  status: string;
  items: OrderItemDto[];
  totalAmount: number;
  assignedToUserId?: string;
  routedToStationId?: string;
  createdAt: Date;
  updatedAt: Date;
}