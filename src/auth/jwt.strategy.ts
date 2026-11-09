import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtClaims, PapelStaff, PrincipalAutenticado } from './principal';

const emissoresPermitidos = ['oficina-auth-lambda', 'oficina-staff'];
const papeisPermitidos: PapelStaff[] = ['ADMIN', 'ATENDENTE', 'MECANICO'];

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET deve estar configurado com pelo menos 32 caracteres',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
      issuer: emissoresPermitidos,
    });
  }

  validate(payload: JwtClaims): PrincipalAutenticado {
    if (
      typeof payload.sub !== 'string' ||
      payload.sub.trim().length === 0 ||
      typeof payload.iss !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Claims de autenticação inválidas');
    }

    if (payload.iss === 'oficina-auth-lambda') {
      return { id: payload.sub, tipo: 'cliente' };
    }

    const papel = papeisPermitidos.find(
      (papelPermitido) => papelPermitido === payload.papel,
    );
    if (payload.iss === 'oficina-staff' && papel) {
      return {
        id: payload.sub,
        tipo: 'staff',
        papel,
      };
    }

    throw new UnauthorizedException('Emissor ou papel de token inválido');
  }
}
