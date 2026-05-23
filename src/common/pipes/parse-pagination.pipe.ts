import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParsePaginationPipe implements PipeTransform {
  transform(value: any) {
    const page = parseInt(value.page, 10) || 1;
    const limit = parseInt(value.limit, 10) || 20;

    if (page < 1) throw new BadRequestException('Page must be >= 1');
    if (limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return { page, limit, offset: (page - 1) * limit };
  }
}
