import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  login: string;

  @Column()
  password: string;

  @Column({ default: 1 })
  active: number;

  @Column({ default: 1 })
  ldap: number;
}
