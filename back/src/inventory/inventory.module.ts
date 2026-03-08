import { Module } from '@nestjs/common';
import { ProductActivatedListener } from './listeners/product-activated.listener';

// TypeOrmModule.forFeature ya no es necesario: el listener usa EntityManager
// (provisto globalmente por TypeOrmModule.forRootAsync), no Repository<Inventory>.
@Module({
  providers: [ProductActivatedListener],
})
export class InventoryModule {}
