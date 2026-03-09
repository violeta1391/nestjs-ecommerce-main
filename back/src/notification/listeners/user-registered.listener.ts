import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserRegisteredEvent } from 'src/events/domain/user-registered.event';

@Injectable()
export class UserRegisteredListener {
  private readonly logger = new Logger(UserRegisteredListener.name);

  @OnEvent(UserRegisteredEvent.EVENT_NAME, { async: true })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    this.logger.log(
      `[user.registered] userId=${event.userId}, email=${event.email}`,
    );
    await this.sendWelcomeEmail(event.email);
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
    // Simulación de envío — reemplazar con Nodemailer / SendGrid / etc.
    this.logger.log(
      `Welcome email dispatched to ${email} — replace with real mailer adapter`,
    );
  }
}
