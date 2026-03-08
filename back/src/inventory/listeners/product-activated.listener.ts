import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inventory } from 'src/database/entities/inventory.entity';
import { ProductActivatedEvent } from 'src/events/domain/product-activated.event';

@Injectable()
export class ProductActivatedListener {
  private readonly logger = new Logger(ProductActivatedListener.name);

  constructor(
    @InjectRepository(Inventory)
    private readonly inventoryRepository: Repository<Inventory>,
  ) {}

  @OnEvent(ProductActivatedEvent.EVENT_NAME, { async: true })
  async handleProductActivated(event: ProductActivatedEvent): Promise<void> {
    this.logger.log(
      `[product.activated] productId=${event.productId}, merchantId=${event.merchantId}, categoryId=${event.categoryId}`,
    );

    // Punto de extensión desacoplado: aquí se puede inicializar stock,
    // notificar sistemas externos, disparar reindexación de búsqueda, etc.
    // sin tocar ProductService.
    this.logger.log(
      `Inventory initialization ready for product ${event.productId}`,
    );
  }
}
