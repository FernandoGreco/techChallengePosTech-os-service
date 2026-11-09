import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { InternalTokenGuard } from './internal-token.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard, InternalTokenGuard],
  exports: [JwtAuthGuard, RolesGuard, InternalTokenGuard],
})
export class AuthModule {}
