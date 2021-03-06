import { Context } from '../common/types';
import { logger } from '../utils/logger';
import { retweetLimit } from './../../bot.config.json';

/**
 * Helper function for scheduled retweets.
 * This function will fetch `x` oldest approved tweets
 * from the database to be retweeted.
 *
 * You can configure `x` from `bot.config.json` in the root directory.
 *
 * @param {Context} context Bot context
 */
export async function scheduledRetweet(
  context: Context,
): Promise<void> {
  logger.info('Scheduled retweet started');

  const tweets = await context.tweetRepository
    .getApprovedTweets(
      retweetLimit,
    );

  const result = await Promise.allSettled(
    tweets.map(tweet => retweet(tweet.tweetId, context)),
  );

  if (result.some(res => !res)) {
    logger.error(`Failed to retweet some scheduled retweets`);
  }
}

/**
 * Retweet a tweet by its ID.
 *
 * @param {string} tweetId Retweeted tweet's ID
 * @param {Context} context Bot context
 */
export async function retweet(
  tweetId: string,
  { tweetRepository, twitterRepository }: Context,
): Promise<void> {
  const retweetResult = await twitterRepository
    .retweet(tweetId);

  if (retweetResult) {
    await tweetRepository.markRetweet(tweetId);

    logger.info(`Successfully retweeted a tweet with id ${tweetId}`);
  } else {
    logger.error(`Failed to retweet a tweet with id ${tweetId}`);
  }
}
