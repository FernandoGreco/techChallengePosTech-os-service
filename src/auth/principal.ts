export type TipoPrincipal = 'cliente' | 'staff';

export type PapelStaff = 'ADMIN' | 'ATENDENTE' | 'MECANICO';

export interface PrincipalAutenticado {
  id: string;
  tipo: TipoPrincipal;
  papel?: PapelStaff;
}

export interface JwtClaims {
  sub?: unknown;
  iss?: unknown;
  papel?: unknown;
  exp?: unknown;
}
