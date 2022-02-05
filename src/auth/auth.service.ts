import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { TokensDto } from './dto/tokens.dto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import {
  getManager,
  LessThan,
  MoreThan,
  MoreThanOrEqual,
  Raw,
  Repository,
} from 'typeorm';
import { UserDto } from './dto/user.dto';
import { v4 } from 'uuid';
import * as ldap from 'ldapjs';
import { RefreshTokenDto } from './dto/refreshToken.dto'
import { UsersTokens } from '../users/users_tokens.entity'
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UsersTokens)
    private usersTokensRepository: Repository<UsersTokens>,
    private jwtService: JwtService,
  ) {}

  async login(userDto: UserDto): Promise<TokensDto> {


    try {
      if (!userDto.password)
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      let userData = await this.usersRepository.findOne({
        where: { login: userDto.username, active: MoreThanOrEqual(0) },
      });

      if (userData !== undefined && userData.active === 0)
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      if (userData === undefined) {
        const ad_user = await this.ldapAuth(userDto.username, userDto.password);
        if (ad_user) {
          userData = await this.registration(userDto);
        } else throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

        return this.setTokens(userData.id);
      }

      if (userData.ldap === 0) {
        const passhash = crypto
          .createHash('sha256')
          .update(
            crypto.createHash('md5').update(userDto.password).digest('hex') +
              crypto.createHash('md5').update(userData.salt).digest('hex'),
          )
          .digest('hex');

        if (userData.password === passhash) {
          return this.setTokens(userData.id);
        } else {
          throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
        }
      } else if (userData.ldap === 1) {
        const ad_user = await this.ldapAuth(userData.login, userDto.password);
        if (!ad_user)
          throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
        return this.setTokens(userData.id);
      }
    } catch (error) {
      throw new HttpException(error.response, error.status);
    }
  }

  async setTokens(userId, usersTokens: UsersTokens = null): Promise<TokensDto> {
    const payload = {
      custom: 0,
      username: {
        id: userId,
        login: '',
      },
    };

    const access_token = this.jwtService.sign(payload);
    const refresh_token = v4();

    if (!usersTokens) {
      usersTokens = {
        id: null,
        user_id: userId,
        token: refresh_token,
        dt_last: new Date(),
        dt_expire: new Date(new Date().setDate(new Date().getDate() + 30)),
      };
    } else {
      usersTokens.user_id = userId;
      usersTokens.token = refresh_token;
      usersTokens.dt_last = new Date();
      usersTokens.dt_expire = new Date(
        new Date().setDate(new Date().getDate() + 30),
      );
    }

    await this.usersTokensRepository.save(usersTokens);
    return {
      access_token,
      refresh_token,
    };
  }

  async ldapAuth(login, password) {
    return new Promise(async (resolve, reject) => {
      try {
        const adData = await this.getAD(login);

        const client = ldap.createClient({
          url: 'ldaps://192.168.60.15:636',
          tlsOptions: { rejectUnauthorized: false },
          reconnect: true,
        });

        return client.bind(adData.dn, password, (err) => {
          resolve(!err);
        });
      } catch (e) {
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);
      }
    });
  }

  async registration(userDto: UserDto): Promise<any> {
    try {
      const res_db_id = await getManager().query(
        `SELECT db_id FROM hr_manager.db_logins
                WHERE login = ? AND dt_block IS NULL LIMIT 1`,
        [userDto.username],
      );

      if (res_db_id.length === 0)
        throw new HttpException('Bad Request', HttpStatus.BAD_REQUEST);

      const db_id = res_db_id[0].db_id;

      const res_groups_vacancy = await getManager().query(
        `SELECT gu.group_id FROM lk.groups_users as gu
                 LEFT JOIN hr_manager.vacancies as v ON v.id = gu.child_id
                 LEFT JOIN hr_manager.db ON db.vacancy_id = v.id
              WHERE db.id = ? AND gu.child_type = 'v' AND v.active = 1`,
        [db_id],
      );

      const res_db_email = await getManager().query(
        `SELECT mb.email FROM hr_manager.db
                    LEFT JOIN lk.mailboxes as mb ON mb.id = db.mailbox_id
               WHERE db.id = ?`,
        [db_id],
      );
      const db_email = res_db_email.length ? res_db_email[0].email : null;

      const adData = await this.getAD(userDto.username);
      const userData = await this.usersRepository.save({
        id: null,
        fname: adData.givenName,
        sname: adData.sn,
        login: userDto.username,
        email: db_email,
        db_id: db_id,
      });
      if (res_groups_vacancy.length > 0) {
        for (const gv of res_groups_vacancy) {
          await getManager().query(
            `INSERT INTO lk.groups_users
             SET group_id   = ?,
                 child_id   = ?,
                 child_type = 'u'`,
            [gv.group_id, userData.id],
          );
        }
      }
      return userData;
    } catch (e) {
      throw new HttpException('Bad Registration', HttpStatus.BAD_REQUEST);
    }
  }

  async getAD(login): Promise<any> {
    return new Promise((resolve, reject) => {
      const username_adm = 'creator';
      const password_adm = '8RHRbWHOHDJe';

      const client = ldap.createClient({
        url: 'ldaps://192.168.60.15:636',
        tlsOptions: { rejectUnauthorized: false },
        reconnect: true,
      });

      client.bind(username_adm, password_adm, (err) => {
        if (err) reject(err);
      });

      const opts = {
        filter: '(samaccountname=' + login + ')',
        scope: 'sub',
        attributes: [
          'dn',
          'memberOf',
          'sn',
          'cn',
          'givenName',
          'samaccountname',
          'useraccountcontrol',
          'distinguishedName',
        ],
      };

      client.search('DC=citycall,DC=local', opts, (err, res) => {
        if (err) reject(err);
        res.on('searchEntry', (entry) => {
          resolve(entry.object);
        });
      });

      client.unbind();
    });
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<TokensDto> {
    const userData = await this.usersTokensRepository.findOne({
      where: {
        token: refreshTokenDto.refresh_token,
        dt_expire: Raw((dt_expire) => `${dt_expire} > NOW()`),
      },
    });

    if (userData) {
      return this.setTokens(userData.user_id, userData);
    }
  }
}
