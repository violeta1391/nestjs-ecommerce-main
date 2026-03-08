import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Inventory } from 'src/database/entities/inventory.entity';
import { ProductVariation } from 'src/database/entities/productVariation.entity';
import { ProductActivatedEvent } from 'src/events/domain/product-activated.event';

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

    // Consultar variaciones del producto activado.
    // ProductService no sabe nada de este módulo — el desacoplamiento opera aquí.
    const variations = await this.entityManager.find(ProductVariation, {
      where: { productId: event.productId },
    });

    if (variations.length === 0) {
      this.logger.log(
        `Product ${event.productId} has no variations yet — inventory will be set up when variations are added`,
      );
      return;
    }

    this.logger.log(
      `Auditing inventory state for ${variations.length} variation(s) of product ${event.productId}`,
    );

    // Para cada variación verificar si ya existe un registro de inventario.
    // Extensión natural: reemplazar el log por entityManager.save(Inventory, {...})
    // cuando se conozcan el país y el stock inicial de cada variación.
    for (const variation of variations) {
      const existing = await this.entityManager.findOne(Inventory, {
        where: { productVariationId: variation.id },
      });

      if (!existing) {
        this.logger.log(
          `[inventory] Variation ${variation.id} — no stock record yet (pending country and quantity assignment)`,
        );
      } else {
        this.logger.log(
          `[inventory] Variation ${variation.id} — current stock: ${existing.quantity} units (country: ${existing.countryCode})`,
        );
      }
    }
  }
}
