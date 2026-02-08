import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class ValidationPipe implements PipeTransform {
  async transform(value: unknown, metadata: ArgumentMetadata) {
    const { metatype, type } = metadata;

    // Skip custom decorators (like @Req, @Res)
    if (type === 'custom') return value;

    // 🔴 CRITICAL FIX — ensure metatype is a class
    if (!metatype || !this.shouldValidate(metatype)) {
      return value;
    }

    // Now safe — TS knows metatype is a constructor
    const object = plainToInstance(metatype, value);

    const errors = await validate(object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const errorMessages = errors
        .map((error) => ({
          field: error.property,
          messages: Object.values(error.constraints || {}),
        }))
        .reduce(
          (acc, curr) => ({ ...acc, [curr.field]: curr.messages }),
          {},
        );

      throw new BadRequestException({
        message: 'Validation failed',
        errors: errorMessages,
      });
    }

    // return transformed DTO instead of raw input
    return object;
  }

  /**
   * Ignore primitives — only validate DTO classes
   */
  private shouldValidate(metatype: Function): boolean {
    const primitiveTypes: Function[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !primitiveTypes.includes(metatype);
  }
}
