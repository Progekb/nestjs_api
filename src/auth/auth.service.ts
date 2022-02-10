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
import { RefreshTokenDto } from './dto/refreshToken.dto';
import { UsersTokens } from '../users/users_tokens.entity';
import * as crypto from 'crypto';

interface IUserData {
  id: number;
  admin?: number;
  login?: string;
  fname?: string;
  sname?: string;
  email?: string;
  roles?: string[];
  roles_rules?: object;
}

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
        throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);

      let userData = await this.usersRepository.findOne({
        where: { login: userDto.username, active: MoreThanOrEqual(0) },
      });

      if (userData !== undefined && userData.active === 0)
        throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);

      if (userData === undefined) {
        const ad_user = await this.ldapAuth(userDto.username, userDto.password);
        if (ad_user) {
          userData = await this.registration(userDto);
        } else
          throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);

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
          throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);
        }
      } else if (userData.ldap === 1) {
        const ad_user = await this.ldapAuth(userData.login, userDto.password);
        if (!ad_user)
          throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);
        return this.setTokens(userData.id);
      }
    } catch (error) {
      throw new HttpException(error.response, error.status);
    }
  }

  async setTokens(
    userId,
    usersTokens: UsersTokens = null,
    type = 'short',
  ): Promise<TokensDto> {
    let userdata: IUserData = {
      id: userId,
    };
    if (type === 'short') {
      userdata = await this.getUserData(userId);
    }
    const payload = {
      type,
      userdata,
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
        throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);
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
        throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);

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
      throw new HttpException('Bad Registration', HttpStatus.UNAUTHORIZED);
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

  async getUserData(userId): Promise<IUserData> {
    const user = await this.usersRepository.findOne({
      select: ['id', 'login', 'fname', 'sname', 'email', 'admin'],
      where: { id: userId, active: 1 },
    });

    return { ...user };
    /*const userData: IUserData = { ...user, roles_rules: {}, roles: [] };

    const sql = `SELECT roles.id, IF(m.module_name IS NOT NULL, m.module_name, 
                  JSON_UNQUOTE(JSON_EXTRACT(roles.\`data\`, '$.module_name'))) as name, 
                  roles.\`data\`, attrs 
                FROM lk.roles 
                    LEFT JOIN lk.modules as m ON m.id = roles.module_id
                            WHERE roles.id IN (
                              SELECT ru.role_id FROM lk.roles_users as ru 
                              WHERE (
                                (ru.child_id = ? AND ru.child_type = 'u') OR (ru.child_id IN (
                                  SELECT gu.group_id FROM lk.groups_users as gu 
                                  LEFT JOIN lk.groups as g ON g.id = gu.group_id
                                  WHERE gu.child_id = ? AND gu.child_type = 'u' AND g.active = 1
                                ) AND ru.child_type = 'g')
                              )
                            ) AND roles.active = 1`;
    const res_roles = await getManager().query(sql, [userId, userId]);

    if (res_roles.length > 0) {
      const roles_rules = {};
      const roles = [];
      for (const role of res_roles) {
        const next_data = JSON.parse(role.data);
        const next_attr = JSON.parse(role.attrs);

        if (!roles_rules[role.name]) {
          roles_rules[role.name] = role;
          roles_rules[role.name]['data'] = next_data;
          roles_rules[role.name]['attrs'] = next_attr;
        } else {
          roles_rules[role.name]['attrs'] = [
            ...roles_rules[role.name]['attrs'],
            ...next_attr,
          ];

          const new_data = roles_rules[role.name]['data'];
          if (Object.keys(next_data).length > 0) {
            for (const k in new_data) {
              if (next_data[k] > new_data[k]) new_data[k] = next_data[k];
            }
          }
          roles_rules[role.name]['data'] = new_data;
        }
        if (roles_rules[role.name]['data']['open'] === 1) {
          roles.push(role.name);
        }
      }
      userData.roles_rules = roles_rules;
      userData.roles = roles;
    }
    return userData;*/
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
    } else {
      throw new HttpException('UnauthorizedError', HttpStatus.UNAUTHORIZED);
    }
  }
}
