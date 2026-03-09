import { Controller, Get } from '@nestjs/common';
import { Auth } from '../../auth/guards/auth.decorator';
import { CurrentUser } from '../../auth/guards/user.decorator';
import { Serialize } from '../../../common/helper/serialize.interceptor';
import { User } from '../../../database/entities/user.entity';
import { UserDto } from '../dto/user.dto';
import { UserService } from '../services/user.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Auth()
  @Serialize(UserDto)
  @Get('profile')
  profile(@CurrentUser() user: User) {
    return this.userService.findById(user.id, { roles: true });
  }
}
