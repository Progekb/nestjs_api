import { Controller, Get, Post, Render } from '@nestjs/common'
// import { AppService } from './app.service';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Hello Drive!';
  }
}
