import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrincipalAutenticado } from '../../auth/principal';
import {
  ORDENS_SERVICO_REPOSITORY,
  type OrdensServicoRepository,
} from './ordens-servico.repository';

@Injectable()
export class ConsultarOrdemServicoUseCase {
  constructor(
    @Inject(ORDENS_SERVICO_REPOSITORY)
    private readonly ordensServicoRepository: OrdensServicoRepository,
  ) {}

  async execute(id: string, principal: PrincipalAutenticado) {
    const ordem = await this.ordensServicoRepository.buscarPorId(id);
    if (
      !ordem ||
      (principal.tipo === 'cliente' && ordem.clienteId !== principal.id)
    ) {
      throw new NotFoundException('Ordem de serviço não encontrada');
    }
    return ordem;
  }

  async consultarStatus(id: string, principal: PrincipalAutenticado) {
    const ordem = await this.execute(id, principal);
    return {
      id: ordem.id,
      numero: ordem.numero,
      status: ordem.status,
      dataCriacao: ordem.dataCriacao,
    };
  }
}
