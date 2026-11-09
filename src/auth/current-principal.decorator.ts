import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { PrincipalAutenticado } from './principal';

type RequestWithPrincipal = Request & { user: PrincipalAutenticado };

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PrincipalAutenticado =>
    context.switchToHttp().getRequest<RequestWithPrincipal>().user,
);
