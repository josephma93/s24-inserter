const express = require('express');
const { redisClient, connectToRedisPromise } = require('./redis');
const debug = require('debug')('s24:sse');
const router = express.Router();

router.get('/', async (req, res) => {
    await connectToRedisPromise; // Asegurarse de que la conexión principal está lista

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sub = redisClient.duplicate();
    await sub.connect();

    sub.on('message', (channel, message) => {
        debug(`Message received on channel ${channel}: ${message}`);
        res.write(`data: ${message}\n\n`);
    });

    await sub.subscribe('puppeteer_feedback', (message) => {
        res.write(`data: ${message}\n\n`);
    });

    req.on('close', async () => {
        debug('Client disconnected, cleaning up...');
        await sub.unsubscribe('puppeteer_feedback');
        await sub.quit();
    });
});

module.exports = router;
