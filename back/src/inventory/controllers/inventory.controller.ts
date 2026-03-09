import { Controller, Get, Param } from '@nestjs/common';
import { Auth } from 'src/api/auth/guards/auth.decorator';
import { FindOneParams } from 'src/common/helper/findOneParams.dto';
import { InventoryService } from '../inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('product/:id')
  @Auth()
  getByProduct(@Param() { id }: FindOneParams) {
    return this.inventoryService.getByProduct(+id);
  }
}
