import { Expose, Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  public email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  public password: string;
}

export class UserDto {
  @Expose()
  public id: number;

  @Expose()
  public email: string;

  @Expose()
  @Transform(({ obj }) =>
    (obj.roles ?? []).map((r: { id: number }) => r.id),
  )
  public roleIds: number[];
}
