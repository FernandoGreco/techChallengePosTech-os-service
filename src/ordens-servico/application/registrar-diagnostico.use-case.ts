import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { PrincipalAutenticado } from '../../auth/principal';
import {
  ORDENS_SERVICO_REPOSITORY,
  type OrdensServicoRepository,
} from './ordens-servico.repository';

export interface RegistrarDiagnosticoCommand {
  ordemServicoId: string;
  diagnostico: string;
  principal: PrincipalAutenticado;
}

@Injectable()
export class RegistrarDiagnosticoUseCase {
  constructor(
    @Inject(ORDENS_SERVICO_REPOSITORY)
    private readonly ordensServicoRepository: OrdensServicoRepository,
  ) {}

  execute(command: RegistrarDiagnosticoCommand) {
    if (
      command.principal.tipo !== 'staff' ||
      !['ADMIN', 'MECANICO'].includes(command.principal.papel ?? '')
    ) {
      throw new ForbiddenException(
        'Somente staff autorizado pode diagnosticar',
      );
    }

    return this.ordensServicoRepository.registrarDiagnostico({
      ordemServicoId: command.ordemServicoId,
      diagnostico: command.diagnostico.trim(),
    });
  }
}
