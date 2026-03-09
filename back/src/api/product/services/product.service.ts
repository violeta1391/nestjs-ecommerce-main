import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductActivatedEvent } from '../../../events/domain/product-activated.event';
import { CreateInventoryDto, CreatePriceDto, CreateProductDto, CreateVariationDto, ProductDetailsDto } from '../dto/product.dto';
import { Category } from '../../../database/entities/category.entity';
import { Color } from '../../../database/entities/color.entity';
import { Country } from '../../../database/entities/country.entity';
import { Currency } from '../../../database/entities/currency.entity';
import { Size } from '../../../database/entities/size.entity';
import { Product } from '../../../database/entities/product.entity';
import { Inventory } from '../../../database/entities/inventory.entity';
import { ProductVariation } from '../../../database/entities/productVariation.entity';
import { ProductVariationPrice } from '../../../database/entities/productVariation_price.entity';
import { errorMessages } from '../../../errors/custom';
import { validate } from 'class-validator';
import { successObject } from '../../../common/helper/sucess-response.interceptor';

export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listProducts(
    userId: number,
    isAdmin: boolean,
    isMerchant: boolean,
    page = 1,
    limit = 10,
    activeOnly = false,
  ): Promise<PaginatedProducts> {
    const skip = (page - 1) * limit;
    const order = { createdAt: 'DESC' as const };
    let items: Product[];
    let total: number;

    if (activeOnly) {
      [items, total] = await this.entityManager.findAndCount(Product, {
        where: { isActive: true },
        order,
        skip,
        take: limit,
      });
    } else if (isAdmin) {
      [items, total] = await this.entityManager.findAndCount(Product, {
        order,
        skip,
        take: limit,
      });
    } else if (isMerchant) {
      [items, total] = await this.entityManager.findAndCount(Product, {
        where: { merchantId: userId },
        order,
        skip,
        take: limit,
      });
    } else {
      [items, total] = await this.entityManager.findAndCount(Product, {
        where: { isActive: true },
        order,
        skip,
        take: limit,
      });
    }

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getProduct(productId: number) {
    const product = await this.entityManager.findOne(Product, {
      where: { id: productId },
    });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);
    return product;
  }

  async createProduct(data: CreateProductDto, merchantId: number) {
    const category = await this.entityManager.findOne(Category, {
      where: { id: data.categoryId },
    });
    if (!category) throw new NotFoundException(errorMessages.category.notFound);

    const product = await this.entityManager.create(Product, {
      category,
      merchantId,
    });
    return this.entityManager.save(product);
  }

  async addProductDetails(
    productId: number,
    body: ProductDetailsDto,
    merchantId: number,
  ) {
    const result = await this.entityManager
      .createQueryBuilder()
      .update<Product>(Product)
      .set({ ...body })
      .where('id = :id', { id: productId })
      .andWhere('merchantId = :merchantId', { merchantId })
      .returning(['id'])
      .execute();

    if (result.affected < 1)
      throw new NotFoundException(errorMessages.product.notFound);
    return result.raw[0];
  }

  async activateProduct(
    productId: number,
    merchantId: number,
    isAdmin = false,
  ) {
    if (!(await this.validate(productId)))
      throw new ConflictException(errorMessages.product.notFulfilled);

    const product = await this.getProduct(productId);

    const query = this.entityManager
      .createQueryBuilder()
      .update<Product>(Product)
      .set({ isActive: true })
      .where('id = :id', { id: productId });

    if (!isAdmin) query.andWhere('merchantId = :merchantId', { merchantId });

    const result = await query.returning(['id', 'isActive']).execute();

    if (result.affected < 1)
      throw new NotFoundException(errorMessages.product.notFound);

    this.eventEmitter.emit(
      ProductActivatedEvent.EVENT_NAME,
      new ProductActivatedEvent(productId, merchantId, product.categoryId),
    );

    return result.raw[0];
  }

  async deactivateProduct(
    productId: number,
    merchantId: number,
    isAdmin = false,
  ): Promise<{ id: number; isActive: boolean }> {
    const query = this.entityManager
      .createQueryBuilder()
      .update<Product>(Product)
      .set({ isActive: false })
      .where('id = :id', { id: productId });

    if (!isAdmin) query.andWhere('merchantId = :merchantId', { merchantId });

    const result = await query.returning(['id', 'isActive']).execute();
    if (result.affected < 1)
      throw new NotFoundException(errorMessages.product.notFound);
    return result.raw[0];
  }

  async validate(productId: number) {
    const product = await this.entityManager.findOne(Product, {
      where: { id: productId },
    });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);
    const errors = await validate(product);
    return errors.length === 0;
  }

  async listColors(): Promise<Color[]> {
    return this.entityManager.find(Color, { order: { name: 'ASC' } });
  }

  async listSizes(): Promise<Size[]> {
    return this.entityManager.find(Size, { order: { code: 'ASC' } });
  }

  async listCountries(): Promise<Country[]> {
    return this.entityManager.find(Country, { order: { name: 'ASC' } });
  }

  async listCurrencies(): Promise<Currency[]> {
    return this.entityManager.find(Currency, { order: { name: 'ASC' } });
  }

  async createVariationInventory(
    productId: number,
    variationId: number,
    body: CreateInventoryDto,
    merchantId: number,
    isAdmin = false,
  ): Promise<{ id: number }> {
    const whereClause = isAdmin ? { id: productId } : { id: productId, merchantId };
    const product = await this.entityManager.findOne(Product, { where: whereClause });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);

    const variation = await this.entityManager.findOne(ProductVariation, {
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Product variation not found');

    const country = await this.entityManager.findOne(Country, { where: { code: body.countryCode } });
    if (!country) throw new NotFoundException('Country not found');

    const inventory = await this.entityManager.save(Inventory, {
      productVariationId: variationId,
      countryCode: body.countryCode,
      quantity: body.quantity,
    });
    return { id: inventory.id };
  }

  async createVariationPrice(
    productId: number,
    variationId: number,
    body: CreatePriceDto,
    merchantId: number,
    isAdmin = false,
  ): Promise<{ id: number }> {
    const whereClause = isAdmin ? { id: productId } : { id: productId, merchantId };
    const product = await this.entityManager.findOne(Product, { where: whereClause });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);

    const variation = await this.entityManager.findOne(ProductVariation, {
      where: { id: variationId, productId },
    });
    if (!variation) throw new NotFoundException('Product variation not found');

    const country = await this.entityManager.findOne(Country, { where: { code: body.countryCode } });
    if (!country) throw new NotFoundException('Country not found');

    const currency = await this.entityManager.findOne(Currency, { where: { code: body.currencyCode } });
    if (!currency) throw new NotFoundException('Currency not found');

    const price = await this.entityManager.save(ProductVariationPrice, {
      productVariationId: variationId,
      countryCode: body.countryCode,
      currencyCode: body.currencyCode,
      price: body.price,
    });
    return { id: price.id };
  }

  async createVariation(
    productId: number,
    body: CreateVariationDto,
    merchantId: number,
    isAdmin = false,
  ): Promise<{ id: number }> {
    const whereClause = isAdmin
      ? { id: productId }
      : { id: productId, merchantId };

    const product = await this.entityManager.findOne(Product, {
      where: whereClause,
    });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);

    const color = await this.entityManager.findOne(Color, {
      where: { name: body.colorName },
    });
    if (!color) throw new NotFoundException('Color not found');

    const size = await this.entityManager.findOne(Size, {
      where: { code: body.sizeCode },
    });
    if (!size) throw new NotFoundException('Size not found');

    const variation = await this.entityManager.save(ProductVariation, {
      productId,
      colorName: body.colorName,
      sizeCode: body.sizeCode,
      imageUrls: [],
    });

    return { id: variation.id };
  }

  async deleteProduct(
    productId: number,
    merchantId: number,
    isAdmin = false,
  ) {

    const whereClause = isAdmin
      ? { id: productId }
      : { id: productId, merchantId };

    const product = await this.entityManager.findOne(Product, {
      where: whereClause,
    });
    if (!product) throw new NotFoundException(errorMessages.product.notFound);

    const variations = await this.entityManager.find(ProductVariation, {
      where: { productId },
    });

    if (variations.length > 0) {
      const variationIds = variations.map((v) => v.id);
      await this.entityManager.delete(Inventory, {
        productVariationId: In(variationIds),
      });
      await this.entityManager.delete(ProductVariationPrice, {
        productVariationId: In(variationIds),
      });
      await this.entityManager.delete(ProductVariation, { productId });
    }

    await this.entityManager.delete(Product, { id: productId });
    return successObject;
  }
}
