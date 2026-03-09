import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { JwtModule } from '@nestjs/jwt';
import { RoleModule } from '../role/role.module';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';

@Module({
  imports: [
    UserModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '3h' },
    }),
    RoleModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [],
})
export class AuthModule {}
