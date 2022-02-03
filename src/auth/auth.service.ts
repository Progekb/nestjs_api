import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TokensDto } from './dto/tokens.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { UserDto } from './dto/user.dto';
import { v4 } from 'uuid';
import { authenticate } from 'ldap-authentication';
import Strategy from 'passport-ldapauth';
import passport from 'passport';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(userDto: UserDto): Promise<TokensDto> {
    try {
      if (!userDto.password)
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      const userData = await this.usersRepository.findOne({
        where: { login: userDto.username, active: MoreThanOrEqual(0) },
      });
      if (!userData || (userData && userData.active === 0))
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      if (userData.ldap === 0) {
        // todo переделать на хэш пароля с солью
        if (userData.password === userDto.password) {
          return this.setTokens(userData);
        } else {
          throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
        }
      } else if (userData.ldap === 1) {
        await this.ldapAuth2(userData.login, userDto.password);
        return this.setTokens(userData.id);
      }
    } catch (error) {
      console.log(error);
      throw new HttpException(error.response, error.status);
    }
  }

  async setTokens(userData): Promise<TokensDto> {
    const payload = {
      username: {
        id: userData.id,
        login: userData.login,
      },
    };
    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: v4(),
    };
  }

  async ldapAuth2(login, password) {
    const OPTS = {
      server: {
        url: 'ldaps://192.168.60.15:636', //LDAP URL
        bindDN: 'CN=adminAccount,DC=forumsys', //Admin BaseDN details
        // bindCredentials: AdminCredentials,
        searchBase: 'dc=forumsys', //search base
        searchFilter:
          '(|(sAMAccountName={{username}})(employeeID={{username}}))',
        timeLimit: 3000,
      },
    };

    passport.use(new Strategy(OPTS));
    passport.initialize();
    passport.authenticate('ldapauth', { session: false }, (err, user, info) => {
      console.log(user);
      console.log(info);
    });
  }

  async ldapAuth(login, password) {
    const options = {
      ldapOpts: {
        url: 'ldaps://192.168.60.15:636',
        // url: 'ldaps://pdc.citycall.local:636',
        tlsOptions: { rejectUnauthorized: false },
      },
      userDn:
        'uid=SKarepanov222_Z1,DC=citycall,DC=local',
      userPassword: 'SKarepanov222_Z1',
      // userSearchBase: 'DC=citycall,DC=local',
      // usernameAttribute: 'samaccountname',
      // username: login + '@domain.local',
      // starttls: false
    };

    const user = await authenticate(options);
    console.log('user', user);
  }
}
