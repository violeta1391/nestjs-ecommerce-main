import { Module } from '@nestjs/common';
import { UserModule } from '../api/user/user.module';
import { ProductActivatedListener } from './listeners/product-activated.listener';
import { InventoryService } from './inventory.service';
import { InventoryController } from './controllers/inventory.controller';

@Module({
  imports: [UserModule],
  controllers: [InventoryController],
  providers: [ProductActivatedListener, InventoryService],
})
export class InventoryModule {}
