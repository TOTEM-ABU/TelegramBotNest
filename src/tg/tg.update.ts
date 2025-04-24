import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Action, Command, Hears, Start, Update } from 'nestjs-telegraf';
import { Book } from 'src/book/entities/book.entity';
import { Context, Markup } from 'telegraf';

@Update()
@Injectable()
export class TgUpdate {
  constructor(
    @InjectModel(Book.name) private readonly bookModel: Model<Book>,
  ) {}
  private readonly channel = '@YOUR_CHANNEL'S_NICKNAME';

  private async checkSubscription(ctx: Context): Promise<boolean> {
    try {
      if (!ctx.from?.id) {
        console.error('User data not available');
        return false;
      }

      const member = await ctx.telegram.getChatMember(
        this.channel,
        ctx.from.id,
      );
      return ['creator', 'administrator', 'member'].includes(member.status);
    } catch (error) {
      console.error('Subscription check error:', error);
      if (error.response?.error_code === 400) {
        await ctx.reply(
          'Bot is not admin in the channel. Please make bot admin!',
        );
      }
      return false;
    }
  }

  private async showSubscriptionPrompt(ctx: Context) {
    await ctx.reply(
      'Please subscribe to our channel to use the bot:',
      Markup.inlineKeyboard([
        Markup.button.url(
          'Subscribe',
          `https://t.me/${this.channel.replace('@', '')}`,
        ),
        Markup.button.callback('Check subscription', 'check_subscription'),
      ]),
    );
  }

  private isValidObjectId(id: string): boolean {
    return (
      Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id
    );
  }

  private async validateBookId(
    id: string,
    ctx: Context,
  ): Promise<Types.ObjectId | null> {
    if (!this.isValidObjectId(id)) {
      await ctx.reply(
        '⚠️ Invalid ID format! Please use format:\n' +
          '<code>/book_507f1f77bcf86cd799439011</code>\n\n' +
          'Get correct ID from /books command',
        { parse_mode: 'HTML' },
      );
      return null;
    }
    return new Types.ObjectId(id);
  }

  @Start()
  async onStart(ctx: Context) {
    if (!ctx.from) return;
    const isSubscribed = await this.checkSubscription(ctx);
    if (!isSubscribed) {
      await this.showSubscriptionPrompt(ctx);
      return;
    }
    await ctx.reply(`Hello ${ctx.from.first_name}! Thanks for subscribing!`);
  }

  @Command('button')
  async onBtn(ctx: Context) {
    if (!ctx.from) return;
    const isSubscribed = await this.checkSubscription(ctx);
    if (!isSubscribed) return;

    await ctx.reply(
      `You're subscribed!`,
      Markup.inlineKeyboard([
        Markup.button.url(
          'Channel',
          `https://t.me/${this.channel.replace('@', '')}`,
        ),
        Markup.button.callback('Check subscription', 'check_subscription'),
      ]),
    );
  }

  @Action('check_subscription')
  async onCheckSubscription(ctx: Context) {
    const isSubscribed = await this.checkSubscription(ctx);
    if (isSubscribed) {
      await ctx.answerCbQuery("Thanks! You're subscribed!");
      await ctx.editMessageText('Now you can use all bot features!');
    } else {
      await ctx.answerCbQuery('Please subscribe first!');
      await this.showSubscriptionPrompt(ctx);
    }
  }

  @Command('addbook')
  async onAddBook(ctx: Context) {
    if (!(await this.checkSubscription(ctx))) return;
    await ctx.reply(
      'To add a book, use format:\n\n' +
        '<code>/add title::author</code>\n\n' +
        'Example: <code>/add Past Days::Abdulla Qodiriy</code>',
      { parse_mode: 'HTML' },
    );
  }

  @Hears(/^\/add (.+?::.+)/)
  async onAdd(ctx: Context) {
    if (
      !(await this.checkSubscription(ctx)) ||
      !ctx.message ||
      !('text' in ctx.message)
    )
      return;

    const [_, data] = ctx.message.text.match(/^\/add (.+?::.+)/) || [];
    const [title, author] = data?.split('::') || [];

    if (!title || !author) {
      await ctx.reply('Invalid format! Please use: title::author');
      return;
    }

    try {
      const book = await this.bookModel.create({ title, author });
      await ctx.reply(`✅ Book added:\n\n📖 ${book.title}\n✍️ ${book.author}`);
    } catch (error) {
      await ctx.reply('❌ Error adding book');
      console.error(error);
    }
  }

  @Command('books')
  async onListBooks(ctx: Context) {
    if (!(await this.checkSubscription(ctx))) return;

    const books = await this.bookModel.find().exec();
    if (books.length === 0) {
      await ctx.reply('No books available yet');
      return;
    }

    const bookList = books
      .map(
        (book, index) =>
          `${index + 1}. ${book.title} - ${book.author}\nID: <code>${book._id}</code>`,
      )
      .join('\n\n');

    await ctx.replyWithHTML(
      `📚 Book list:\n\n${bookList}\n\n` + `Use /book_[id] to view details`,
      Markup.inlineKeyboard([
        Markup.button.callback('Refresh', 'refresh_books'),
      ]),
    );
  }

  @Action('refresh_books')
  async onRefreshBooks(ctx: Context) {
    await this.onListBooks(ctx);
    await ctx.answerCbQuery('List refreshed');
  }

  @Hears(/^\/book_([a-f\d]{24})$/)
  async onGetBook(ctx: Context) {
    if (
      !(await this.checkSubscription(ctx)) ||
      !ctx.message ||
      !('text' in ctx.message)
    )
      return;

    const match = ctx.message.text.match(/^\/book_([a-f\d]{24})$/);
    if (!match) return;

    const objectId = await this.validateBookId(match[1], ctx);
    if (!objectId) return;

    try {
      const book = await this.bookModel.findById(objectId).exec();
      if (!book) {
        await ctx.reply('❌ Book not found');
        return;
      }

      await ctx.replyWithHTML(
        `📖 <b>${book.title}</b>\n✍️ Author: ${book.author}\n\n` +
          `🆔 ID: <code>${book._id}</code>`,
        Markup.inlineKeyboard([
          Markup.button.callback('Delete', `delete_${book._id}`),
          Markup.button.callback('Edit', `edit_${book._id}`),
        ]),
      );
    } catch (error) {
      console.error('Error getting book:', error);
      await ctx.reply('❗ Error retrieving book');
    }
  }

  @Action(/^delete_([a-f\d]{24})$/)
  async onDeleteBook(ctx: Context) {
    const match = (ctx.update as any).callback_query?.data.match(
      /^delete_([a-f\d]{24})$/,
    );
    if (!match) return;

    const objectId = await this.validateBookId(match[1], ctx);
    if (!objectId) return;

    try {
      const deletedBook = await this.bookModel
        .findByIdAndDelete(objectId)
        .exec();
      if (!deletedBook) {
        await ctx.answerCbQuery('Book not found');
        return;
      }
      await ctx.editMessageText(
        `✅ Book deleted:\n\n📖 ${deletedBook.title}\n✍️ ${deletedBook.author}`,
      );
      await ctx.answerCbQuery('Book deleted');
    } catch (error) {
      console.error('Delete error:', error);
      await ctx.answerCbQuery('❌ Error deleting book');
    }
  }

  @Action(/^edit_([a-f\d]{24})$/)
  async onEditBook(ctx: Context) {
    const match = (ctx.update as any).callback_query?.data.match(
      /^edit_([a-f\d]{24})$/,
    );
    if (!match) return;

    const objectId = await this.validateBookId(match[1], ctx);
    if (!objectId) return;

    await ctx.replyWithHTML(
      `To edit book, send:\n\n` +
        `<code>/update ${objectId} new title::new author</code>\n\n` +
        `Example: <code>/update ${objectId} New Title::New Author</code>`,
    );
    await ctx.answerCbQuery('Edit instructions sent');
  }

  @Hears(/^\/update ([a-f\d]{24}) (.+?::.+)/)
  async onUpdate(ctx: Context) {
    if (
      !(await this.checkSubscription(ctx)) ||
      !ctx.message ||
      !('text' in ctx.message)
    )
      return;

    const match = ctx.message.text.match(/^\/update ([a-f\d]{24}) (.+?::.+)/);
    if (!match) return;

    const objectId = await this.validateBookId(match[1], ctx);
    if (!objectId) return;

    const [title, author] = match[2].split('::');
    if (!title || !author) {
      await ctx.reply('Invalid format! Use: /update id new title::new author');
      return;
    }

    try {
      const updatedBook = await this.bookModel
        .findByIdAndUpdate(objectId, { title, author }, { new: true })
        .exec();

      if (!updatedBook) {
        await ctx.reply('Book not found');
        return;
      }

      await ctx.replyWithHTML(
        `✅ Book updated:\n\n📖 <b>${updatedBook.title}</b>\n✍️ ${updatedBook.author}`,
      );
    } catch (error) {
      console.error('Update error:', error);
      await ctx.reply('❌ Error updating book');
    }
  }
}
