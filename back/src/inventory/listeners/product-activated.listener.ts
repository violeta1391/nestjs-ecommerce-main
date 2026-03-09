import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Inventory } from '../../database/entities/inventory.entity';
import { Product } from '../../database/entities/product.entity';
import { ProductVariation } from '../../database/entities/productVariation.entity';
import { ProductActivatedEvent } from '../../events/domain/product-activated.event';

@Injectable()
export class ProductActivatedListener {
  private readonly logger = new Logger(ProductActivatedListener.name);

  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  @OnEvent(ProductActivatedEvent.EVENT_NAME, { async: true })
  async handleProductActivated(event: ProductActivatedEvent): Promise<void> {
    this.logger.log(
      `[product.activated] productId=${event.productId}, merchantId=${event.merchantId}, categoryId=${event.categoryId}`,
    );

    await this.withRetry(
      () => this.setupInventory(event),
      `inventory-setup:product-${event.productId}`,
    );
  }

  private async setupInventory(event: ProductActivatedEvent): Promise<void> {
    const variations = await this.entityManager.find(ProductVariation, {
      where: { productId: event.productId },
    });

    if (variations.length === 0) {
      const product = await this.entityManager.findOne(Product, {
        where: { id: event.productId },
      });

      if (product?.variationType === 'NONE') {
        const defaultVariation = await this.entityManager.save(ProductVariation, {
          productId: event.productId,
          sizeCode: 'NA',
          colorName: 'NA',
          imageUrls: [],
        });

        await this.entityManager.save(Inventory, {
          productVariationId: defaultVariation.id,
          countryCode: 'EG',
          quantity: 0,
        });

        this.logger.log(
          `[inventory] Product ${event.productId}: created default variation ${defaultVariation.id} and inventory record (quantity=0, country=EG)`,
        );
      } else {
        this.logger.log(
          `Product ${event.productId} has no variations yet — inventory will be set up when variations are added`,
        );
      }
      return;
    }

    this.logger.log(
      `Setting up inventory for ${variations.length} variation(s) of product ${event.productId}`,
    );

    for (const variation of variations) {
      const existing = await this.entityManager.findOne(Inventory, {
        where: { productVariationId: variation.id },
      });

      if (!existing) {
        await this.entityManager.save(Inventory, {
          productVariationId: variation.id,
          countryCode: 'EG',
          quantity: 0,
        });
        this.logger.log(
          `[inventory] Created inventory record for variation ${variation.id} (quantity=0, country=EG)`,
        );
      } else {
        this.logger.log(
          `[inventory] Variation ${variation.id} already has stock: ${existing.quantity} units (country: ${existing.countryCode})`,
        );
      }
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    retries = 3,
    baseDelayMs = 500,
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (attempt === retries) {
          this.logger.error(
            `[${label}] Failed after ${retries} attempts: ${String(err)}`,
          );
          throw err;
        }
        const delay = baseDelayMs * attempt;
        this.logger.warn(
          `[${label}] Attempt ${attempt} failed, retrying in ${delay}ms — ${String(err)}`,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
}
