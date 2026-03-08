import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inventory } from 'src/database/entities/inventory.entity';
import { ProductActivatedListener } from './listeners/product-activated.listener';

@Module({
  imports: [TypeOrmModule.forFeature([Inventory])],
  providers: [ProductActivatedListener],
})
export class InventoryModule {}
