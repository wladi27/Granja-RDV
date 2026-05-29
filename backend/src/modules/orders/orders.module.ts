import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { PublicOrdersController } from './public-orders.controller';

@Module({
  controllers: [OrdersController, PublicOrdersController],
})
export class OrdersModule {}
