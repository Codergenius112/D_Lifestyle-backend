import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order }    from '../../shared/entities/order.entity';
import { MenuItem } from '../../shared/entities/menu-item.entity';
import { OrderService }   from './orders.service';
import { OrdersController } from './orders.controller';
import { MenuService }    from './menu.service';
import { MenuController } from './menu.controller';
import { AuditModule }    from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, MenuItem]),
    AuditModule,
  ],
  providers:   [OrderService, MenuService],
  controllers: [OrdersController, MenuController],
  exports:     [OrderService, MenuService],
})
export class OrdersModule {}