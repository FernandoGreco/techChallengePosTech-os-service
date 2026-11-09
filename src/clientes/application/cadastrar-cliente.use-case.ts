import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  CLIENTES_REPOSITORY,
  CadastrarClienteInput,
  type ClientesRepository,
} from './clientes.repository';
import {
  documentoValido,
  normalizarDocumento,
} from '../../shared/validators/documento';

@Injectable()
export class CadastrarClienteUseCase {
  constructor(
    @Inject(CLIENTES_REPOSITORY)
    private readonly clientesRepository: ClientesRepository,
  ) {}

  execute(input: CadastrarClienteInput) {
    const documento = normalizarDocumento(input.documento);
    if (!documentoValido(input.tipoDocumento, documento)) {
      throw new BadRequestException('Documento inválido');
    }

    return this.clientesRepository.cadastrar({
      ...input,
      documento,
      nome: input.nome.trim(),
      email: input.email.trim().toLowerCase(),
      telefone: input.telefone.trim(),
    });
  }
}
