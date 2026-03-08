export class UserRegisteredEvent {
  static readonly EVENT_NAME = 'user.registered';

  constructor(
    public readonly userId: number,
    public readonly email: string,
  ) {}
}
