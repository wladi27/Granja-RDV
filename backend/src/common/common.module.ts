import { Global, Module } from '@nestjs/common';
import { DomainService } from './domain.service';

@Global()
@Module({
  providers: [DomainService],
  exports: [DomainService],
})
export class CommonModule {}
