import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from '../../shared/entities/menu-item.entity';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuItemRepository: Repository<MenuItem>,
  ) {}

  async getMenu(venueId: string, category?: string): Promise<{
    items: MenuItem[];
    total: number;
    categories: string[];
  }> {
    const query = this.menuItemRepository
      .createQueryBuilder('m')
      .where('m.venueId = :venueId', { venueId })
      .andWhere('m.isAvailable = :isAvailable', { isAvailable: true });

    if (category) {
      query.andWhere('m.category = :category', { category });
    }

    query.orderBy('m.category', 'ASC').addOrderBy('m.sortOrder', 'ASC');

    const items = await query.getMany();

    const allItems = await this.menuItemRepository.find({
      where: { venueId, isAvailable: true },
      select: ['category'],
    });
    const categories = [...new Set(allItems.map((i) => i.category))];

    return { items, total: items.length, categories };
  }

  async getMenuItem(id: string): Promise<MenuItem> {
    const item = await this.menuItemRepository.findOne({
      where: { id, isAvailable: true },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  async createMenuItem(data: Partial<MenuItem>): Promise<MenuItem> {
    const item = this.menuItemRepository.create(data);
    return this.menuItemRepository.save(item);
  }

  async updateMenuItem(id: string, data: Partial<MenuItem>): Promise<MenuItem> {
    await this.menuItemRepository.update(id, data);
    return this.getMenuItem(id);
  }

  async deactivateMenuItem(id: string): Promise<void> {
    await this.menuItemRepository.update(id, { isAvailable: false });
  }
}