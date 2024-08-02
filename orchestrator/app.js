const Docker = require('dockerode');
const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

const redisHost = process.env.S24_ORCHESTRATOR_REDIS_HOST;
const redisPassword = process.env.S24_ORCHESTRATOR_REDIS_PASSWORD;
const scriptDir = process.env.S24_ORCHESTRATOR_SCRIPT_DIR;
const debug = process.env.S24_ORCHESTRATOR_DEBUG === 'true';

if (!redisHost || !redisPassword || !scriptDir) {
    console.error('Missing required environment variables. Please ensure REDIS_HOST, REDIS_PASSWORD, and SCRIPT_DIR are set.');
    process.exit(1);
}

// Conexión para suscripción
const redisSubscriber = new Redis({
    host: redisHost,
    password: redisPassword,
});

// Conexión para publicación
const redisPublisher = new Redis({
    host: redisHost,
    password: redisPassword,
});

redisSubscriber.on('error', (err) => {
    console.error('Redis subscriber error:', err);
    process.exit(1);
});

redisSubscriber.on('connect', () => {
    if (debug) {
        console.log('Connected to Redis subscriber');
    }
});

const feedbackQueue = 'puppeteer_feedback';

const docker = new Docker({socketPath: '/var/run/docker.sock'});

docker.ping()
    .then(() => {
        if (debug) {
            console.log('Connected to Docker');
        }
    })
    .catch((err) => {
        console.error('Docker ping error:', err);
        process.exit(1);
    });

redisSubscriber.subscribe('puppeteer_queue', (err) => {
    if (err) {
        console.error('Failed to subscribe to puppeteer_queue:', err);
        process.exit(1);
    } else {
        console.log('Subscribed to puppeteer_queue');
    }
});

redisSubscriber.on('message', async (channel, message) => {
    if (channel === 'puppeteer_queue') {
        if (debug) {
            console.log('Received raw message:', message);
        }
        try {
            const params = JSON.parse(message);
            if (debug) {
                console.log('Parsed params:', params);
            }
            const validationResult = validateParams(params);
            if (validationResult.isValid) {
                publishFeedback('info', 'Received message and starting Docker command execution.');
                await runDockerCommand(params);
            } else {
                publishFeedback('error', validationResult.error);
            }
        } catch (err) {
            console.error('Error processing message:', err);
            publishFeedback('error', `Error processing message: ${err.message}`);
        }
    }
});

function validateParams(params) {
    const requiredFields = ['transactionType', 'date'];
    for (const field of requiredFields) {
        if (!params[field]) {
            return {isValid: false, error: `Error: ${field} is required`};
        }
    }

    const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;
    if (!dateRegex.test(params.date)) {
        return {isValid: false, error: 'Invalid date format. Please use yyyy-mm-dd format.'};
    }

    if (['donation', 'deposit'].includes(params.transactionType)) {
        if (!params.worldDonations && !params.localDonations) {
            return {
                isValid: false,
                error: 'Error: Either worldDonations or localDonations is required for donation or deposit action',
            };
        }
    }

    return {isValid: true};
}

function publishFeedback(status, message) {
    const feedback = {status, message};
    redisPublisher.publish(feedbackQueue, JSON.stringify(feedback), (err) => {
        if (err) {
            console.error('Failed to publish feedback:', err);
        }
    });
}

async function runDockerCommand(params) {
    const dockerCmd = [
        'mkdir -p /home/pptruser/workdir',
        'cp -r /home/pptruser/app/{.,}* /home/pptruser/workdir/',
        'cd /home/pptruser/workdir',
        'npm ci',
        `node insert-s-24-record.mjs --action ${params.transactionType} --date ${params.date} --world-work-amount ${params.worldDonations} --congregation-amount ${params.localDonations}`,
    ].join(' && ');

    try {
        const container = await createDockerContainer(dockerCmd);
        await startDockerContainer(container);
        await logDockerContainer(container);  // Capturar y mostrar logs
        await waitForDockerContainer(container);
    } catch (err) {
        if (err.statusCode === 404 && err.json && err.json.message.includes('No such image')) {
            await handleImageNotFoundError(params);
        } else {
            console.error('Failed to start Docker container:', err);
            publishFeedback('error', `Puppeteer script execution failed: ${err.message}`);
        }
    }
}

async function createDockerContainer(dockerCmd) {
    try {
        const container = await docker.createContainer({
            Image: 'ghcr.io/puppeteer/puppeteer:22.10.0',
            Cmd: ['bash', '-c', dockerCmd],
            HostConfig: {
                Binds: [`${scriptDir}:/home/pptruser/app:ro`],
                AutoRemove: true,
                Init: true,
                CapAdd: ['SYS_ADMIN'],
            },
        });

        if (debug) {
            console.log('Docker container created.');
        }

        return container;
    } catch (err) {
        throw err;
    }
}

async function startDockerContainer(container) {
    try {
        if (debug) {
            console.log('Starting Docker container.');
        }

        await container.start();
    } catch (err) {
        throw err;
    }
}

async function logDockerContainer(container) {
    try {
        const stream = await container.logs({
            follow: true,
            stdout: true,
            stderr: true,
        });

        stream.on('data', (data) => {
            console.log('Docker logs:', data.toString());
        });
    } catch (err) {
        console.error('Error capturing Docker logs:', err);
    }
}

async function waitForDockerContainer(container) {
    try {
        const data = await container.wait();

        if (debug) {
            console.log('Docker container exited with status:', data.StatusCode);
        }

        if (data.StatusCode !== 0) {
            publishFeedback('error', `Puppeteer script execution failed with exit code ${data.StatusCode}`);
        } else {
            publishFeedback('info', 'Puppeteer script executed successfully.');
        }
    } catch (err) {
        throw err;
    }
}

async function handleImageNotFoundError(params) {
    try {
        if (debug) {
            console.log('Image not found locally, pulling image from registry.');
        }

        const onFinished = async (err, output) => {
            if (err) {
                console.error('Error pulling Docker image:', err);
                publishFeedback('error', `Failed to pull Docker image: ${err.message}`);
                return;
            }
            // Retry creating and starting the container
            await runDockerCommand(params);
        };

        const onProgress = (event) => {
            if (debug) {
                console.log('Docker pull progress:', event);
            }
        };

        await docker.pull('ghcr.io/puppeteer/puppeteer:22.10.0', (err, stream) => {
            if (err) {
                throw err;
            }
            docker.modem.followProgress(stream, onFinished, onProgress);
        });
    } catch (pullError) {
        console.error('Failed to pull Docker image:', pullError);
        publishFeedback('error', `Failed to pull Docker image: ${pullError.message}`);
    }
}
