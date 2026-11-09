import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class ConsultarClienteDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @IsString()
  @Matches(/^\d{11}$/)
  cpf!: string;
}
