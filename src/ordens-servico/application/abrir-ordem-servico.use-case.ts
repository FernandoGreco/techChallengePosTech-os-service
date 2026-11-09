import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrincipalAutenticado } from '../../auth/principal';
import {
  ORDENS_SERVICO_REPOSITORY,
  type OrdensServicoRepository,
} from './ordens-servico.repository';

export interface AbrirOrdemServicoCommand {
  clienteId?: string;
  veiculoId: string;
  principal: PrincipalAutenticado;
}

@Injectable()
export class AbrirOrdemServicoUseCase {
  constructor(
    @Inject(ORDENS_SERVICO_REPOSITORY)
    private readonly ordensServicoRepository: OrdensServicoRepository,
  ) {}

  execute(command: AbrirOrdemServicoCommand) {
    const clienteId =
      command.principal.tipo === 'cliente'
        ? command.principal.id
        : command.clienteId;
    if (!clienteId) {
      throw new BadRequestException('clienteId é obrigatório para staff');
    }

    return this.ordensServicoRepository.abrir({
      id: randomUUID(),
      clienteId,
      veiculoId: command.veiculoId,
    });
  }
}
