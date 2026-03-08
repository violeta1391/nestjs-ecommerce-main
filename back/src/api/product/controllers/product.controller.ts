import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RoleIds } from '../../role/enum/role.enum';
import { CreateProductDto, ProductDetailsDto } from '../dto/product.dto';
import { ProductService } from '../services/product.service';
import { Auth } from 'src/api/auth/guards/auth.decorator';
import { FindOneParams } from 'src/common/helper/findOneParams.dto';
import { CurrentUser } from 'src/api/auth/guards/user.decorator';
import { User } from 'src/database/entities/user.entity';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Auth()
  @Get()
  async listProducts(@CurrentUser() user: User) {
    const isAdmin = user.roles?.some((r) => r.id === RoleIds.Admin);
    const isMerchant = user.roles?.some((r) => r.id === RoleIds.Merchant);
    return this.productService.listProducts(user.id, isAdmin, isMerchant);
  }

  @Get(':id')
  async getProduct(@Param() product: FindOneParams) {
    return this.productService.getProduct(product.id);
  }

  @Auth(RoleIds.Admin, RoleIds.Merchant)
  @Post('create')
  async createProduct(
    @Body() body: CreateProductDto,
    @CurrentUser() user: User,
  ) {
    return this.productService.createProduct(body, user.id);
  }

  @Auth(RoleIds.Admin, RoleIds.Merchant)
  @Post(':id/details')
  async addProductDetails(
    @Param() product: FindOneParams,
    @Body() body: ProductDetailsDto,
    @CurrentUser() user: User,
  ) {
    return this.productService.addProductDetails(product.id, body, user.id);
  }

  @Auth(RoleIds.Admin, RoleIds.Merchant)
  @Post(':id/activate')
  async activateProduct(
    @Param() product: FindOneParams,
    @CurrentUser() user: User,
  ) {
    const isAdmin = user.roles?.some((r) => r.id === RoleIds.Admin);
    return this.productService.activateProduct(product.id, user.id, isAdmin);
  }

  @Auth(RoleIds.Admin, RoleIds.Merchant)
  @Post(':id/deactivate')
  async deactivateProduct(
    @Param() product: FindOneParams,
    @CurrentUser() user: User,
  ) {
    const isAdmin = user.roles?.some((r) => r.id === RoleIds.Admin);
    return this.productService.deactivateProduct(product.id, user.id, isAdmin);
  }

  @Auth(RoleIds.Admin, RoleIds.Merchant)
  @Delete(':id')
  async deleteProduct(
    @Param() product: FindOneParams,
    @CurrentUser() user: User,
  ) {
    return this.productService.deleteProduct(product.id, user.id);
  }
}
