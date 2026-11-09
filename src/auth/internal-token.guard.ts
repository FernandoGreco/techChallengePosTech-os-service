import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expectedToken = process.env.INTERNAL_API_TOKEN;
    if (!expectedToken) {
      throw new ServiceUnavailableException(
        'Autenticação serviço-a-serviço não está configurada',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const suppliedToken = request.header('x-internal-service-token');
    if (!suppliedToken) {
      throw new UnauthorizedException('Credencial de serviço obrigatória');
    }

    const expected = Buffer.from(expectedToken);
    const supplied = Buffer.from(suppliedToken);
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    ) {
      throw new UnauthorizedException('Credencial de serviço inválida');
    }

    return true;
  }
}
