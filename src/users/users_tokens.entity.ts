import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, OneToOne } from 'typeorm'
import { User } from './user.entity'

@Entity('users_tokens')
export class UsersTokens {
  @PrimaryGeneratedColumn()
  id: number;
  //
  // @ManyToOne(() => User, (user) => user.id)
  // user_id: User;

  @Column()
  user_id: number;

  @Column()
  token: string;

  @Column({ type: 'datetime' })
  dt_last: Date;

  @Column({ type: 'datetime' })
  dt_expire: Date;
}
