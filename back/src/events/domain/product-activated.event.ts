export class ProductActivatedEvent {
  static readonly EVENT_NAME = 'product.activated';

  constructor(
    public readonly productId: number,
    public readonly merchantId: number,
    public readonly categoryId: number,
  ) {}
}
