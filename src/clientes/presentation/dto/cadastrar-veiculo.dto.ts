import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CadastrarVeiculoDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.replace(/[^a-z0-9]/gi, '').toUpperCase()
      : value,
  )
  @IsString()
  @Matches(/^[A-Z]{3}\d[A-Z0-9]\d{2}$/)
  placa!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  marca!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  modelo!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  ano!: number;
}
