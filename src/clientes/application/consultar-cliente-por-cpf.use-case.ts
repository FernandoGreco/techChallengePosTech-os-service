import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CLIENTES_REPOSITORY,
  type ClientesRepository,
} from './clientes.repository';
import {
  cpfValido,
  normalizarDocumento,
} from '../../shared/validators/documento';

@Injectable()
export class ConsultarClientePorCpfUseCase {
  constructor(
    @Inject(CLIENTES_REPOSITORY)
    private readonly clientesRepository: ClientesRepository,
  ) {}

  execute(cpf: string) {
    const documento = normalizarDocumento(cpf);
    if (!cpfValido(documento)) {
      throw new BadRequestException('CPF inválido');
    }
    return this.clientesRepository.buscarPorCpf(documento);
  }
}
