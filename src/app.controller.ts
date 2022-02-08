import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { User } from './users/user.entity';
// import { AppService } from './app.service';
import { machineId, machineIdSync } from 'node-machine-id';

class Ip {
  @ApiProperty()
  ip: string;
}

@Controller()
export class AppController {
  // @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('/getIP')
  @ApiResponse({ status: 200, description: 'Get your IP' })
  @ApiOkResponse({ type: Ip })
  getProfile(@Request() req) {
    return { ip: req.headers['x-forwarded-for'] };
  }

  // @Get('/machineId')
  // async getFinger() {
  //   return await machineId(true);
  // }
}
