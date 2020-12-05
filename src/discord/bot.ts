import { Client, Collection, Guild, Message, MessageReaction, TextChannel, User } from 'discord.js';
import { format } from 'date-fns';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import { prefix, channelName } from './../../bot.config.json';
import { CommandHandler, Context, HandlerFunction, RETWEET } from '../common/types';
import { Tweet } from '../entity/tweet';

export class DallyDoseBot {
  private readonly commands: Collection<string, HandlerFunction>;
  private readonly guilds: Collection<string, Guild>;

  constructor(
    private readonly client: Client,
    private readonly context: Context,
  ) {
    this.commands = new Collection();

    const commandFiles = readdirSync(resolve(__dirname, 'commands'));
    commandFiles.forEach(async (file: string): Promise<void> => {
      const { command, execute }: CommandHandler = await import(
        resolve(__dirname, 'commands', file)
      );

      this.commands.set(command, execute);
    });

    this.guilds = client.guilds.cache;

    this.client.addListener('message', this.onMessage);
    this.client.addListener('messageReactionAdd', this.onReact);
    this.client.addListener('ready', this.onReady);
  }

  private onReady = async (): Promise<void> => {
    // for each connected guild, create a text channel to manage this bot
    this.guilds.forEach(async (guild: Guild) => {
      const channel = guild.channels.cache.find(
        channel => channel.name === channelName,
      );

      if (!channel) { // create a new
        await guild.channels.create(channelName, { type: 'news' });
      } else if (channel.type !== 'news') {
        throw new Error('Channel already exists, specify different channel name in the configuration');
      }
    });

    this.client.user?.setPresence({
      status: 'online',
      activity: {
        type: 'CUSTOM_STATUS',
        name: 'Managing your daily dose of tweets',
      },
    });
  }

  private onMessage = async (message: Message): Promise<Message | undefined> => {
    if (message.author.bot || !message.content.startsWith(prefix)) {
      return;
    }

    if (message.partial) { // prevent partials
      await message.fetch();
    }

    const args = message.content.slice(prefix.length).split(/ +/);
    const commandName = (args.shift() as string).toLowerCase();

    const handler = this.commands.get(commandName);

    if (handler) {
      return handler(message, args, this.context);
    } else {
      return message.reply(
        `Command unknown, please refer to \`${prefix}help\` for more information about how to use this bot.`,
      );
    }
  }

  private onReact = async (reaction: MessageReaction, user: User): Promise<void> => {
    const emoji = reaction.emoji;
    if (user.bot) { // add target emoji later
      return;
    }

    if (reaction.partial) { // prevent partials
      await reaction.fetch();
    }

    const url = /https:\/\/twitter.com\/\w+\/status\/(\d+)/;
    const tweetId = (reaction.message.content.match(url) as RegExpMatchArray)[1];

    // add conditions for target emoji

    this.context.emitter.emit(RETWEET, tweetId);
  }

  public sendFreshTweets = async (tweets: Tweet[]): Promise<void> => {
    const messageFormatter = (tweet: Tweet) => {
      return '**FRESH TWEETS**' +
        '\n\n' +
        `Author: **@${tweet.author}**` +
        '\n' +
        `Fetched At: ${format(tweet.fetchedAt, 'D MMMM YYYY — HH:mm Z')}` +
        '\n' +
        `Link: ${tweet.url}` +
        '\n\n' +
        '**React to manage this tweet**';
    };

    this.guilds.forEach(async (guild: Guild): Promise<void> => {
      const channel = guild.channels.cache.find(
        channel => channel.name === channelName,
      );

      if (channel) {
        const textChannel = channel as TextChannel;

        const messages = await Promise.all(
          tweets.map(
            tweet => textChannel.send(messageFormatter(tweet)),
          ),
        );

        await Promise.all(messages);
      } else {
        throw new Error('Failed to initialize bot correctly');
      }
    });
  }

  /**
   * Start the bot with supplied token
   *
   * @param {string} token Discord token
   * @returns {Promise<boolean>} A boolean whether if login commited successfully
   */
  public start = async (token: string): Promise<boolean> => {
    const usedToken = await this.client.login(token);

    return usedToken === token;
  }
}
