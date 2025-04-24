import { Module } from '@nestjs/common';
import { TgUpdate } from './tg.update';
import { TelegrafModule } from 'nestjs-telegraf';
import { BookService } from 'src/book/book.service';
import { BookModule } from 'src/book/book.module';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: 'YOUR_TELEGRAMBOT`S_TOKEN',
    }),
    BookModule,
  ],
  providers: [TgUpdate, BookService],
})
export class TgModule {}
