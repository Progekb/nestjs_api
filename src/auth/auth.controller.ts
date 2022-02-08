import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { UserDto } from './dto/user.dto';
import { TokensDto } from './dto/tokens.dto';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('/login')
  @HttpCode(200)
  async login(@Body() userDto: UserDto): Promise<TokensDto> {
    return await this.authService.login(userDto);
  }

  @Post('/refreshtoken')
  @HttpCode(200)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
  ): Promise<TokensDto> {
    return await this.authService.refreshToken(refreshTokenDto);
  }

  // @Post('/setcustomtoken')
  // @HttpCode(200)
  // async setCustomToken(
  //   @Body() : ,
  // ): Promise<TokensDto> {
  //   return await this.authService.setCustomToken();
  // }
}
