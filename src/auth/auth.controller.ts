import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { TokensDto } from './dto/tokens.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post()
  @HttpCode(200)
  async login(@Body() userDto: UserDto): Promise<TokensDto> {
    return await this.authService.login(userDto);
  }
}
