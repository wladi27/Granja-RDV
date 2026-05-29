import { Injectable } from '@nestjs/common';
import {
  Commission,
  Order,
  Product,
  SystemConfig,
  User,
} from '../domain/models';

@Injectable()
export class InMemoryStoreService {
  readonly users: User[] = [];
  readonly orders: Order[] = [];
  readonly commissions: Commission[] = [];
  readonly products: Product[] = [
    { id: 'p1', name: 'Carne premium 1kg', priceCop: 42000, stock: 500 },
    { id: 'p2', name: 'Docena de huevos campesinos', priceCop: 18000, stock: 1200 },
    { id: 'p3', name: 'Queso fresco 500g', priceCop: 22000, stock: 700 },
    { id: 'p4', name: 'Chorizo artesanal 1kg', priceCop: 36000, stock: 450 },
  ];

  config: SystemConfig = {
    commissionLevels: [
      { level: 1, amountCop: 5000, enabled: true },
      { level: 2, amountCop: 3000, enabled: true },
      { level: 3, amountCop: 1500, enabled: true },
    ],
    gracePeriodDays: 3,
    minWithdrawalCop: 50000,
    deliveryCommissionPercent: 0,
    maxCommissionLevels: 10,
    enabledPaymentMethods: ['wallet', 'bank_transfer', 'mobile_payment', 'cash'],
    paymentAccounts: [],
    deliveryFeesByMunicipality: {
      Dosquebradas: 12000,
      Pereira: 12000,
      Cuba: 12000,
    },
  };
}
