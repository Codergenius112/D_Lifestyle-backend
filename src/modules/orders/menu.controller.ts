import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, UseGuards, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../shared/enums';
import { MenuService } from './menu.service';

@ApiTags('Menu')
@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  // GET /menu?venueId=xxx&category=food — public
  @Get()
  async getMenu(
    @Query('venueId') venueId: string,
    @Query('category') category?: string,
  ) {
    return this.menuService.getMenu(venueId, category);
  }

  // GET /menu/:id — public
  @Get(':id')
  async getMenuItem(@Param('id') id: string) {
    return this.menuService.getMenuItem(id);
  }

  // POST /menu — admin/manager only
  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  @HttpCode(201)
  async createMenuItem(@Body() dto: any) {
    return this.menuService.createMenuItem(dto);
  }

  // PATCH /menu/:id — admin/manager only
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MANAGER)
  async updateMenuItem(@Param('id') id: string, @Body() dto: any) {
    return this.menuService.updateMenuItem(id, dto);
  }

  // DELETE /menu/:id — admin only
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deactivateMenuItem(@Param('id') id: string) {
    await this.menuService.deactivateMenuItem(id);
    return { message: 'Menu item deactivated' };
  }
}