import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PapelStaff, PrincipalAutenticado } from './principal';
import { PAPEIS_PERMITIDOS_KEY } from './roles.decorator';

type RequestWithPrincipal = Request & { user: PrincipalAutenticado };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<PapelStaff[]>(
      PAPEIS_PERMITIDOS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!papeis?.length) {
      return true;
    }

    const principal = context
      .switchToHttp()
      .getRequest<RequestWithPrincipal>().user;
    return (
      principal.tipo === 'staff' &&
      !!principal.papel &&
      papeis.includes(principal.papel)
    );
  }
}
