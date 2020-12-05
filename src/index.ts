import { Client } from 'discord.js';
import { config } from 'dotenv';
import { DallyDoseBot } from './discord/bot';
import { TwitterRepository } from './repository/twitter';
import Twitter from 'twitter-lite';
import { TweetRepository } from './repository/db/tweet';
import { UserRepository } from './repository/db/user';
import { getDb } from './utils/db';
import { EventEmitter } from 'events';

(async function() {
  if (process.env.NODE_ENV === 'development') {
    config();
  }

  const emitter = new EventEmitter();

  const db = await getDb();
  const tweetRepository = new TweetRepository(db);
  const userRepository = new UserRepository(db);

  if (!process.env.CONSUMER_TOKEN || !process.env.CONSUMER_SECRET) {
    throw new Error('Twitter tokens has not been set');
  }

  if (!process.env.DISCORD_TOKEN) {
    throw new Error('Discord token has not been set');
  }

  const discordClient = new Client();
  const twitterClient = new Twitter({
    consumer_key: process.env.CONSUMER_TOKEN,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token_key: process.env.TWITTER_TOKEN,
    access_token_secret: process.env.TWITTER_SECRET,
  });

  const twitterRepository = new TwitterRepository(twitterClient);

  const bot = new DallyDoseBot(
    discordClient,
    { twitterRepository, tweetRepository, userRepository, emitter },
  );

  try {
    const feedback = await bot.start(process.env.DISCORD_TOKEN);

    if (process.env.NODE_ENV === 'development') {
      if (feedback) {
        console.log('DallyDose successfully connected to Discord server!');
      }
    }
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error(err);
    }

    throw err;
  }
})();
