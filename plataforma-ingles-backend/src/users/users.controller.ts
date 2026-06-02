import { Controller, Get, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('buscar')
  findOne(
    @Query('email') email?: string,
    @Query('username') username?: string,
  ) {
    if (email) return this.usersService.findOneByEmail(email);
    if (username) return this.usersService.findOneByUsername(username);
    return { error: 'Indicá ?email= o ?username=' };
  }
}
