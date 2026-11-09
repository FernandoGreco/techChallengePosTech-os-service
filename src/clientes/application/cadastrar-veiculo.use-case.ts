import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CadastrarVeiculoInput,
  CLIENTES_REPOSITORY,
  type ClientesRepository,
} from './clientes.repository';

@Injectable()
export class CadastrarVeiculoUseCase {
  constructor(
    @Inject(CLIENTES_REPOSITORY)
    private readonly clientesRepository: ClientesRepository,
  ) {}

  execute(input: CadastrarVeiculoInput) {
    const placa = input.placa.replace(/[^a-z0-9]/gi, '').toUpperCase();
    if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) {
      throw new BadRequestException('Placa inválida');
    }
    if (!Number.isInteger(input.ano) || input.ano < 1900 || input.ano > 2100) {
      throw new BadRequestException('Ano do veículo inválido');
    }

    return this.clientesRepository.cadastrarVeiculo({
      ...input,
      placa,
      marca: input.marca.trim(),
      modelo: input.modelo.trim(),
    });
  }
}
