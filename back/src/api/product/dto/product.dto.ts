import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDefined,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  activeOnly?: boolean;
}
import { variationTypesKeys } from 'src/database/entities/product.entity';
import { ProductDetails, ProductDetailsTypeFn } from './productDetails';

export class CreateProductDto {
  @IsNumber()
  @IsNotEmpty()
  public categoryId: number;
}

export class ProductDetailsDto {
  @IsString()
  @IsNotEmpty()
  public title: string;

  @IsString()
  @IsNotEmpty()
  public code: string;

  @IsDefined()
  @IsString()
  @IsIn(variationTypesKeys)
  public variationType: string;

  @IsDefined()
  @Type(ProductDetailsTypeFn)
  @ValidateNested()
  public details: ProductDetails;

  @ArrayMinSize(1)
  @IsString({ each: true })
  public about: string[];

  @IsString()
  @IsNotEmpty()
  public description: string;
}
