import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { Permissions } from '../../common/permissions.decorator';
import { DomainService } from '../../common/domain.service';
import { AdminPermission, SystemConfig } from '../../domain/models';

@Controller('config')
@UseGuards(JwtAuthGuard)
export class ConfigController {
  constructor(private readonly domainService: DomainService) {}

  @Get('withdrawal-rules')
  async getWithdrawalRules() {
    const config = await this.domainService.getConfig();
    return {
      minWithdrawalCop: config.minWithdrawalCop,
    };
  }

  @Get('payment-settings')
  async getPaymentSettings() {
    const config = await this.domainService.getConfig();
    return {
      enabledPaymentMethods: config.enabledPaymentMethods,
      paymentAccounts: config.paymentAccounts.filter((account) => config.enabledPaymentMethods.includes(account.method)),
      deliveryFeesByMunicipality: config.deliveryFeesByMunicipality,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  getConfig() {
    return this.domainService.getConfig();
  }

  @Patch()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  updateConfig(@Body() patch: Partial<SystemConfig>) {
    return this.domainService.updateConfig(patch);
  }

  @Get('admin-users')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  getAdminUsers() {
    return this.domainService.getAdminUsers();
  }

  @Post('admin-users')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  createAdminUser(
    @Body()
    body: {
      fullName: string;
      username: string;
      email: string;
      password: string;
      permissions: AdminPermission[];
    },
  ) {
    return this.domainService.createAdminUser(body);
  }

  @Patch('admin-users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  updateAdminUser(
    @Param('id') adminUserId: string,
    @Body()
    body: {
      fullName?: string;
      username?: string;
      email?: string;
      password?: string;
      permissions?: AdminPermission[];
    },
  ) {
    return this.domainService.updateAdminUser({
      adminUserId,
      fullName: body.fullName,
      username: body.username,
      email: body.email,
      password: body.password,
      permissions: body.permissions,
    });
  }

  @Get('courier-users')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  getCourierUsers() {
    return this.domainService.getCourierUsers();
  }

  @Post('courier-users')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  createCourierUser(
    @Body()
    body: {
      fullName: string;
      username: string;
      email: string;
      whatsappPhone?: string;
      password: string;
    },
  ) {
    return this.domainService.createCourierUser(body);
  }

  @Patch('courier-users/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('config.manage')
  updateCourierUser(
    @Param('id') courierUserId: string,
    @Body()
    body: {
      fullName?: string;
      username?: string;
      email?: string;
      whatsappPhone?: string;
      password?: string;
    },
  ) {
    return this.domainService.updateCourierUser({
      courierUserId,
      fullName: body.fullName,
      username: body.username,
      email: body.email,
      whatsappPhone: body.whatsappPhone,
      password: body.password,
    });
  }
}
