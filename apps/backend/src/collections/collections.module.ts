import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { CollectionDeadlineService } from './collection-deadline.service';

@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionDeadlineService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
