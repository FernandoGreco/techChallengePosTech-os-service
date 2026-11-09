import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentPrincipal } from '../../auth/current-principal.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import type { PrincipalAutenticado } from '../../auth/principal';
import { Papeis } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { AbrirOrdemServicoUseCase } from '../application/abrir-ordem-servico.use-case';
import { ConsultarOrdemServicoUseCase } from '../application/consultar-ordem-servico.use-case';
import { RegistrarDiagnosticoUseCase } from '../application/registrar-diagnostico.use-case';
import { AbrirOrdemServicoDto } from './dto/abrir-ordem-servico.dto';
import { RegistrarDiagnosticoDto } from './dto/registrar-diagnostico.dto';

@Controller('api/v1/ordens-servico')
@UseGuards(JwtAuthGuard)
export class OrdensServicoController {
  constructor(
    private readonly abrirOrdemServico: AbrirOrdemServicoUseCase,
    private readonly consultarOrdemServico: ConsultarOrdemServicoUseCase,
    private readonly registrarDiagnostico: RegistrarDiagnosticoUseCase,
  ) {}

  @Post()
  abrir(
    @Body() dto: AbrirOrdemServicoDto,
    @CurrentPrincipal() principal: PrincipalAutenticado,
  ) {
    return this.abrirOrdemServico.execute({ ...dto, principal });
  }

  @Get(':id/status')
  consultarStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: PrincipalAutenticado,
  ) {
    return this.consultarOrdemServico.consultarStatus(id, principal);
  }

  @Get(':id')
  consultar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentPrincipal() principal: PrincipalAutenticado,
  ) {
    return this.consultarOrdemServico.execute(id, principal);
  }

  @Patch(':id/diagnostico')
  @UseGuards(RolesGuard)
  @Papeis('ADMIN', 'MECANICO')
  diagnosticar(
    @Param('id', new ParseUUIDPipe()) ordemServicoId: string,
    @Body() dto: RegistrarDiagnosticoDto,
    @CurrentPrincipal() principal: PrincipalAutenticado,
  ) {
    return this.registrarDiagnostico.execute({
      ordemServicoId,
      diagnostico: dto.diagnostico,
      principal,
    });
  }
}
