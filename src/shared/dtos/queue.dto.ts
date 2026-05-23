import { IsUUID, IsOptional } from 'class-validator';

export class JoinQueueDto {
  @IsUUID()
  venueId: string;
}

export class QueueCheckInDto {
  @IsUUID()
  queueId: string;
}

export class QueueResponseDto {
  id: string;
  venueId: string;
  position: number;
  status: string;
  createdAt: Date;
}