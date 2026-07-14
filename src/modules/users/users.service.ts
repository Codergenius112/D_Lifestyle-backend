import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../shared/entities/user.entity';

export interface PublicUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Looks up other users by email/name — used by the group booking flow to
   * turn "who do you want to invite" into real participant user IDs. Only
   * returns non-sensitive fields (never passwordHash, role, etc.) since this
   * is reachable by any authenticated customer, not just admins.
   */
  async search(query: string, excludeUserId: string): Promise<PublicUserSummary[]> {
    if (!query || query.trim().length < 2) return [];

    const users = await this.userRepository.find({
      where: [
        { email: ILike(`%${query}%`), isActive: true, isDeleted: false },
        { firstName: ILike(`%${query}%`), isActive: true, isDeleted: false },
        { lastName: ILike(`%${query}%`), isActive: true, isDeleted: false },
      ],
      take: 10,
    });

    return users
      .filter((u) => u.id !== excludeUserId)
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      }));
  }
}
