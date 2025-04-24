import { Module } from '@nestjs/common';
import { TgUpdate } from './tg.update';
import { TelegrafModule } from 'nestjs-telegraf';
import { BookService } from 'src/book/book.service';
import { BookModule } from 'src/book/book.module';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: '7590432507:AAGTLovd4e9enJZED65td-ffYk3hULj4y5s',
    }),
    BookModule,
  ],
  providers: [TgUpdate, BookService],
})
export class TgModule {}
