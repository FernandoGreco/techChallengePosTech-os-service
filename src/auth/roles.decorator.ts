import { SetMetadata } from '@nestjs/common';
import { PapelStaff } from './principal';

export const PAPEIS_PERMITIDOS_KEY = 'papeis-permitidos';

export const Papeis = (...papeis: PapelStaff[]) =>
  SetMetadata(PAPEIS_PERMITIDOS_KEY, papeis);
