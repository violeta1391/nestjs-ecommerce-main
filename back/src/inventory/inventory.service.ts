import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { Inventory } from '../database/entities/inventory.entity';
import { ProductVariation } from '../database/entities/productVariation.entity';

export interface InventoryRecord {
  id: number;
  productVariationId: number;
  countryCode: string;
  quantity: number;
  variation: {
    sizeCode: string;
    colorName: string;
  };
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
  ) {}

  async getByProduct(productId: number): Promise<InventoryRecord[]> {
    const variations = await this.entityManager.find(ProductVariation, {
      where: { productId },
    });

    if (variations.length === 0) return [];

    const variationIds = variations.map((v) => v.id);
    const records = await this.entityManager.find(Inventory, {
      where: { productVariationId: In(variationIds) },
    });

    const variationMap = new Map(variations.map((v) => [v.id, v]));

    return records.map((inv) => ({
      id: inv.id,
      productVariationId: inv.productVariationId,
      countryCode: inv.countryCode,
      quantity: inv.quantity,
      variation: {
        sizeCode: variationMap.get(inv.productVariationId)?.sizeCode ?? 'NA',
        colorName: variationMap.get(inv.productVariationId)?.colorName ?? 'NA',
      },
    }));
  }
}
