import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TgModule } from './tg/tg.module';
import { BookModule } from './book/book.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from './book/entities/book.entity';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/nest-tgbot'),
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
    TgModule,
    BookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
