import { Module } from '@nestjs/common';
import { ProductService } from './services/product.service';
import { ProductController } from './controllers/product.controller';
import { Category } from '../../database/entities/category.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from 'src/database/entities/product.entity';
import { UserModule } from '../user/user.module';

// UserModule es necesario porque AuthGuard (usado por @Auth() en ProductController)
// inyecta UserService. El servicio de producto no usa UserService directamente,
// pero el guard sí requiere que esté disponible en el contexto del módulo.
// User eliminado de forFeature: ProductService usa EntityManager, no Repository<User>.
@Module({
  imports: [TypeOrmModule.forFeature([Product, Category]), UserModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
