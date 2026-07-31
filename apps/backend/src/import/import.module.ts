import {
  BadRequestException,
  Controller,
  Module,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@credit-core/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { parseRealEstateWorkbook } from './excel-parse.util';
import { decodeUploadName } from '../common/upload-name.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OPERATOR, Role.ADMIN)
@Controller('import')
class ImportController {
  constructor(private readonly prisma: PrismaService) {}

  /** Parse an uploaded .xlsx and return a prefilled payload (operator confirms). */
  @Post('real-estate/parse')
  @UseInterceptors(FileInterceptor('file'))
  async parse(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fayl yuborilmadi');
    const result = await parseRealEstateWorkbook(file.buffer, decodeUploadName(file.originalname));
    await this.prisma.importJob.create({
      data: {
        sourceFileName: decodeUploadName(file.originalname),
        status: 'PARSED',
        parsedJson: result as unknown as object,
      },
    });
    return result;
  }
}

@Module({ controllers: [ImportController] })
export class ImportModule {}
