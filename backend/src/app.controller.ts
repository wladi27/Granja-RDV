import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './infrastructure/database/database.service';

@Controller()
export class AppController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  getRoot() {
    return {
      service: 'GRV API',
      status: 'ok',
    };
  }

  @Get('health/db')
  async getDatabaseHealth() {
    return this.databaseService.ping();
  }
}
