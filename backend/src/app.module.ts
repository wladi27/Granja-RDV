import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from './common/common.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AppController } from './app.controller';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ConfigSystemModule } from './modules/config/config.module';
import { OrdersModule } from './modules/orders/orders.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    ConfigSystemModule,
    UsersModule,
    CatalogModule,
    OrdersModule,
    WithdrawalsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
