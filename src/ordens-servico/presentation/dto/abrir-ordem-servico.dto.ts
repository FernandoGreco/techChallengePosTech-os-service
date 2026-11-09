import { IsOptional, IsUUID } from 'class-validator';

export class AbrirOrdemServicoDto {
  @IsUUID()
  veiculoId!: string;

  @IsOptional()
  @IsUUID()
  clienteId?: string;
}
