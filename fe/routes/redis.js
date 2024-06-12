const redis = require('redis');
const debug = require('debug')('s24:redis');

const redisClient = redis.createClient({
    url: `redis://default:${process.env.REDIS_PASSWORD}@leaflex.site/1`,
    socket: {
        reconnectStrategy: 3,
    }
});

redisClient.on('error', (err) => {
    debug('Redis client error', err);
});

async function connectToRedis() {
    await redisClient.connect();
    debug('Redis client connected');
}

module.exports = {
    redisClient,
    connectToRedisPromise: connectToRedis(),
};
