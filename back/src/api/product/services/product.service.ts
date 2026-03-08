import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ProductActivatedEvent } from 'src/events/domain/product-activated.event';
import { CreateProductDto, ProductDetailsDto } from '../dto/product.dto';
import { Category } from '../../../database/entities/category.entity';
import { Product } from 'src/database/entities/product.entity';
import { errorMessages } from 'src/errors/custom';
import { validate } from 'class-validator';
import { successObject } from 'src/common/helper/sucess-response.interceptor';

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

    // activeOnly=true → always filter active only, regardless of role (used by dashboard)
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

  async deleteProduct(
    productId: number,
    merchantId: number,
    isAdmin = false,
  ) {
    const query = this.entityManager
      .createQueryBuilder()
      .delete()
      .from(Product)
      .where('id = :productId', { productId });

    if (!isAdmin) query.andWhere('merchantId = :merchantId', { merchantId });

    const result = await query.execute();
    if (result.affected < 1)
      throw new NotFoundException(errorMessages.product.notFound);
    return successObject;
  }
}
