import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  login: string;

  @Column()
  password: string;

  @Column()
  db_id: number;

  @Column()
  fname: string;

  @Column()
  sname: string;

  @Column()
  email: string;

  @Column()
  salt: string;

  @Column()
  data: string;

  @Column({ default: 1 })
  active: number;

  @Column({ default: 1 })
  ldap: number;

  @Column({ default: 0 })
  admin: number;
}
