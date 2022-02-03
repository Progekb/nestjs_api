import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'mysql.city-call.ru',
      port: 3306,
      username: 'api',
      password: 'sewo67we0y',
      database: 'lk',
      entities: [User],
      timezone: '+05:00',
      dateStrings: true,
      debug: false,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
