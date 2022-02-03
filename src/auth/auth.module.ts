import { Module } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { jwtConstants } from './constants';
import { AuthService } from './auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    PassportModule,
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: jwtConstants.secret,
      signOptions: {
        expiresIn: '30m',
        audience: ['lk', 'api', 'drive'],
        issuer: 'api',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService],
  exports: [],
})
export class AuthModule {}
