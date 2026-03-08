import { Module } from '@nestjs/common';
import { UserRegisteredListener } from './listeners/user-registered.listener';

@Module({
  providers: [UserRegisteredListener],
})
export class NotificationModule {}
