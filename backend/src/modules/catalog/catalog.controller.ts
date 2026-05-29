import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PermissionsGuard } from '../../common/permissions.guard';
import { Permissions } from '../../common/permissions.decorator';
import { DomainService } from '../../common/domain.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly domainService: DomainService) {}

  @Get('products')
  getProducts() {
    return this.domainService.getProducts();
  }

  @Get('products/page')
  getProductsPage(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(24), ParseIntPipe) pageSize: number,
    @Query('search') search?: string,
  ) {
    return this.domainService.getProductsPage(page, pageSize, search);
  }

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('inventory.manage')
  createProduct(@Body() body: { id?: string; name: string; priceCop: number; stock: number }) {
    return this.domainService.createProduct(body);
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('inventory.manage')
  updateProduct(
    @Param('id') productId: string,
    @Body() body: { name?: string; priceCop?: number; stock?: number },
  ) {
    return this.domainService.updateProduct(productId, body);
  }

  @Patch('products/:id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('inventory.manage')
  adjustStock(@Param('id') productId: string, @Body() body: { delta: number }) {
    return this.domainService.adjustProductStock(productId, body.delta);
  }

  @Delete('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
  @Roles('admin')
  @Permissions('inventory.manage')
  deleteProduct(@Param('id') productId: string) {
    return this.domainService.deleteProduct(productId);
  }
}
