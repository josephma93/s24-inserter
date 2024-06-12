const express = require('express');
const router = express.Router();
const debug = require('debug')('s24:submit-form');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const { redisClient, connectToRedisPromise } = require('./redis');

router.post('/', upload.single('s24capture'), async function postReqHandler(req, res, next) {
    await connectToRedisPromise;  // Esperar a que la conexión se establezca
    debug('Form has been received');
    debug('Has file: %s', !!req.file);
    debug('%O', req.body);

    const puppeteerArgs = JSON.stringify({
        date: req.body.date,
        transactionType: req.body.transactionType,
        worldDonations: req.body.worldDonations,
        localDonations: req.body.localDonations,
        concept1: req.body.concept1,
        amount1: req.body.amount1,
        concept2: req.body.concept2,
        amount2: req.body.amount2,
        concept3: req.body.concept3,
        amount3: req.body.amount3
    });

    try {
        await redisClient.publish('puppeteer_queue', puppeteerArgs);
        debug('Published to Redis queue');

        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) {
                    debug('Failed to delete file: %O', err);
                } else {
                    debug('File deleted successfully');
                }
            });
        }

        res.render('sse_view');
    } catch (err) {
        debug('Failed to publish to queue: %O', err);
        res.status(500).send('Error interno del servidor');
    }
});

module.exports = router;
