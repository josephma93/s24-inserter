import 'dotenv/config'
import {InfisicalClient} from "@infisical/sdk";
import {Command} from 'commander';
import puppeteer from 'puppeteer';
import {authenticator} from 'otplib';
import redis from 'redis';

const client = new InfisicalClient({
    clientId: process.env.INFISICAL_CLIENT_ID,
    clientSecret: process.env.INFISICAL_CLIENT_SECRET,
    siteUrl: process.env.INFISICAL_SITE_URL,
});

const program = new Command();
program
    .name('s24inserter')
    .description('CLI tool for performing various actions on JW Hub')
    .requiredOption('-a, --action <action>', 'Action to perform (donation, deposit, payment, other)')
    .requiredOption('-d, --date <date>', 'Transaction date in yyyy-mm-dd format')
    .option('-ww, --world-work-amount <amount>', 'World Work amount', null)
    .option('-ce, --congregation-amount <amount>', 'Congregation amount', null)
    .option('--debug', 'Enable debug mode')
    .option('--visible', 'Make puppeteer run non-headless')
    .addHelpText('after', `
Examples:
  $ s24inserter -a donation -d 2023-12-25 --world-work-amount 100
  $ s24inserter -a deposit -d 2024-01-01 --congregation-amount 200
    `);

program.parse(process.argv);
const options = program.opts();

(function validateOptions(opts) {
    const requiredParams = ['action', 'date'];
    for (const param of requiredParams) {
        if (!opts[param]) {
            console.error(`Error: ${param} is required`);
            program.help();
            process.exit(1);
        }
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(opts.date)) {
        console.error('Invalid date format. Please use yyyy-mm-dd format.');
        process.exit(1);
    }

    if (opts.action === 'donation' || opts.action === 'deposit') {
        if (!opts.worldWorkAmount && !opts.congregationAmount) {
            console.error('Error: Either --world-work-amount (or --ww) or --ce) is required for donation or deposit action');
            process.exit(1);
        }
    }
})(options);

async function fetchSecretsFromInfisical() {
    const usernameSecret = await client.getSecret({
        environment: "prod",
        secretName: "USERNAME",
        projectId: process.env.INFISICAL_PROJECT_ID,
    });

    const passwordSecret = await client.getSecret({
        environment: "prod",
        secretName: "PASSWORD",
        projectId: process.env.INFISICAL_PROJECT_ID,
    });

    const mfaSecret = await client.getSecret({
        environment: "prod",
        secretName: "MFA",
        projectId: process.env.INFISICAL_PROJECT_ID,
    });

    const redisPwd = await client.getSecret({
        environment: "prod",
        secretName: "REDIS_PASSWORD",
        projectId: process.env.INFISICAL_PROJECT_ID,
    });

    const username = usernameSecret.secretValue;
    const password = passwordSecret.secretValue;
    const mfa = mfaSecret.secretValue;
    const redisPassword = redisPwd.secretValue;

    if (!username || !password || !mfa || !redisPassword) {
        throw new Error('Error: Failed to retrieve one or more secrets from Infisical');
    }

    return {username, password, mfa, redisPassword};
}

async function buildRedisClients(password) {
    const client = redis.createClient({
        url: `redis://default:${password}@leaflex.site/1`,
        socket: {
            reconnectStrategy: 3,
        }
    });

    client.on('error', (err) => {
        console.error('Redis error:', err);
    });

    await client.connect();

    const publisher = client.duplicate();
    publisher.on('error', err => console.error('Redis Publisher error:', err));
    await publisher.connect();

    return {redisClient: client, redisPublisher: publisher};
}

async function startBrowserAndGetPage() {
    await publishFeedback('info', 'Starting browser...');
    const browser = await puppeteer.launch({
        headless: options.visible ? false : 'new',
        args: ['--lang=es-CR,es', '--no-sandbox', '--disable-setuid-sandbox'],
        slowMo: options.visible ? 25 : undefined,
    });
    await publishFeedback('info', 'Browser launched.');

    const pages = await browser.pages();
    const page = pages[0];
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    return {browser, page};
}

async function goToPageAndCloseCookiesNotice(page) {
    await publishFeedback('info', 'Navigating to JW Hub...');
    await page.goto('https://hub.jw.org/');
    await publishFeedback('info', 'Page loaded and closing cookies...');

    try {
        await page.waitForSelector(`.lnc-firstRunPopup`, {visible: true});
        await page.click(`button.lnc-acceptCookiesButton`);
        await page.waitForSelector(`.lnc-firstRunPopup`, {hidden: true});
    } finally {
        await publishFeedback('info', 'Cookies closed.');
    }
}

async function waitForAndTypeUsername(page, username) {
    await publishFeedback('info', 'Entering username...');
    await page.waitForSelector('#username', {visible: true});
    await page.type('#username', username);
    await page.click('#submit-button');
    await publishFeedback('info', 'Username submitted.');
}

async function waitForAndTypePassword(page, password) {
    await publishFeedback('info', 'Entering password...');
    await page.waitForSelector('#passwordInput', {visible: true});
    await page.type('#passwordInput', password);
    await page.click(`#submit-button, #submitButton`);
    await publishFeedback('info', 'Password submitted.');
}

async function waitForAndTypeMFACode(page, mfa) {
    await publishFeedback('info', 'Entering OTP...');
    const otp = authenticator.generate(mfa);
    await page.waitForSelector(`[id="form.code"]`, {visible: true});
    await page.type(`[id="form.code"]`, otp);
    await page.click(`.button.button--primary`);
    await publishFeedback('info', 'OTP submitted.');
}

async function navigateToAccountingSection(page) {
    await publishFeedback('info', 'Navigating to accounting section...');
    await page.waitForSelector('app-groups ul li:nth-child(3) ul.list li:nth-child(2) a', {visible: true});
    await page.click('app-groups ul li:nth-child(3) ul.list li:nth-child(2) a');
    await publishFeedback('info', 'Section accessed.');
}

async function performAction(page) {
    await publishFeedback('info', 'Performing action...');
    await page.waitForSelector('.button.button--action.button--has-icon', {visible: true});
    await page.click('.grid__item .button.button--action.button--has-icon');
    await publishFeedback('info', 'Action performed.');
}

async function navigateToTransactionsSection(page, action) {
    await publishFeedback('info', `Navigating to transactions section...`);
    await page.waitForSelector('app-transactions', {visible: true});
    switch (action) {
        case 'donation':
            await page.click('app-transactions .list li:nth-child(1) article');
            break;
        case 'deposit':
            await page.click('app-transactions .list li:nth-child(2) article');
            break;
        case 'payment':
            await page.click('app-transactions .list li:nth-child(3) article');
            break;
        case 'other':
            await page.click('app-transactions .list li:nth-child(4) article');
            break;
        default:
            throw new Error('Invalid action specified');
    }
    await publishFeedback('info', `Transaction ${action} action selected.`);
}

async function fillOutForm(page, date, worldWorkAmount, congregationAmount) {
    await publishFeedback('info', 'Filling out form...');
    await page.waitForSelector('app-collected-contributions', {visible: true});

    async function selectDate(dateString) {
        const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
        const formattedDate = `${day}/${month}/${year}`;
        const dayNum = day;
        await page.click(`[icon="calendar"]`);
        await page.waitForSelector('.datepicker__window', {visible: true});

        await page.evaluate((dayNum) => {
            const days = Array.from(document.querySelectorAll('.month__week-day--selectable'));
            const targetDay = days.find(d => parseInt(d.innerText.trim(), 10) === dayNum);
            if (targetDay) {
                targetDay.click();
            } else {
                throw new Error(`Day ${dayNum} not found in the datepicker.`);
            }
        }, dayNum);

        return formattedDate;
    }

    const formattedDate = await selectDate(date);

    const worldWorkSelector = 'input[id="form.contributions.0:0.amount"]';
    await page.type(worldWorkSelector, worldWorkAmount);
    const congregationSelector = 'input[id="form.contributions.1:1.amount"]';
    await page.type(congregationSelector, congregationAmount);

    await publishFeedback('info', `Form filled with date: ${formattedDate} and proceeding to next steps...`);
    await page.click('.button--primary');
    await page.waitForSelector('app-attach-multi-file', {visible: true});
    await page.click('.button--primary');
    await page.waitForSelector('app-activity-summary', {visible: true});
    await publishFeedback('info', 'Form submission completed.');
}

async function main({page, username, password, mfa, date, action, worldWorkAmount, congregationAmount}) {
    if (options.debug) {
        console.log('Argument Variables:');
        console.log(`Username: ${username}`);
        console.log(`Password: ${'*'.repeat(password.length)}`);
        console.log(`MFA: ${mfa}`);
        console.log(`Date: ${date}`);
        console.log(`Action: ${action}`);
        console.log(`World Work Amount: ${worldWorkAmount}`);
        console.log(`Congregation Amount: ${congregationAmount}`);
    }
    await goToPageAndCloseCookiesNotice(page);
    await waitForAndTypeUsername(page, username);
    await waitForAndTypePassword(page, password);
    await waitForAndTypeMFACode(page, mfa);
    await navigateToAccountingSection(page);
    await performAction(page);
    await navigateToTransactionsSection(page, action);
    await fillOutForm(page, date, worldWorkAmount, congregationAmount);
}

if (options.debug) {
    console.log('Environment Variables:');
    console.log(`INFISICAL_CLIENT_ID: ${process.env.INFISICAL_CLIENT_ID}`);
    console.log(`INFISICAL_CLIENT_SECRET: ${process.env.INFISICAL_CLIENT_SECRET}`);
    console.log(`INFISICAL_SITE_URL: ${process.env.INFISICAL_SITE_URL}`);
    console.log(`INFISICAL_PROJECT_ID: ${process.env.INFISICAL_PROJECT_ID}`);
}

const secrets = await fetchSecretsFromInfisical();
const {redisClient, redisPublisher} = await buildRedisClients(secrets.redisPassword);

async function publishFeedback(status, message) {
    const feedback = JSON.stringify({status, message});
    console.log(message);
    await redisPublisher.publish('puppeteer_feedback', feedback);
}

async function closeRedisConnections() {
    await redisPublisher.disconnect();
    await redisClient.disconnect();
}

const {browser, page} = await startBrowserAndGetPage();

try {
    await main({
        page,
        ...secrets,
        ...options,
    });
} catch (error) {
    console.error('An error occurred:', error.message);
    console.error(error.stack);
    await publishFeedback('error', error.message);
    try {
        await page.$$eval(`svg`, svg => svg.forEach(e => e.remove()));
        const html = await page.content();
        console.log('Current HTML dump start.');
        console.log(html);
        console.log('Current HTML dump finish.');
    } catch (innerError) {
        console.error('Failed to dump HTML due to:', innerError.message);
        await publishFeedback('error', innerError.message);
    }
} finally {
    await publishFeedback('info', 'Closing browser...');
    await browser.close();
    await publishFeedback('info', 'Browser closed. Process completed.');
    await closeRedisConnections();
}
