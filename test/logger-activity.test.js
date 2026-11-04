const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const logger = require('../services/logger');

test('activity logging is opt-in for operational events and redacts secrets', { concurrency: false }, async () => {
    const sent = [];
    process.env.ACTIVITY_LOG_CHANNEL_ID = 'activity-channel';
    process.env.ACTIVITY_LOG_EVENTS = 'command';

    logger.setClient({
        channels: {
            fetch: async id => ({
                id,
                isTextBased: () => true,
                send: async payload => sent.push(payload),
            }),
        },
    });

    logger.activity('streak', 'Ignored', { Token: 'secret-value' });
    logger.activity('command', 'Command Executed', {
        Command: '/ping',
        "API Key": 'api_key=secret-value',
    });

    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(sent.length, 1);
    assert.equal(sent[0].embeds[0].data.title, 'TT Tools — Command Executed');
    assert.match(
        JSON.stringify(sent[0].embeds[0].data),
        /\[REDACTED\]/
    );

    delete process.env.ACTIVITY_LOG_CHANNEL_ID;
    delete process.env.ACTIVITY_LOG_EVENTS;
});

test('SOTD activity is emitted only for API confirmations, not cache reads', { concurrency: false }, async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-activity-sotd-'));
    process.env.TYCOON_API_KEY = 'test-key';
    process.env.SOTD_CACHE_FILE = path.join(cacheDir, 'sotd.json');
    process.env.SOTD_FAILURE_COOLDOWN_MS = '10';

    const tycoonPath = require.resolve('../utils/tycoon');
    const refresherPath = require.resolve('../services/sotdRefresher');
    delete require.cache[tycoonPath];
    delete require.cache[refresherPath];

    const tycoon = require('../utils/tycoon');
    const { refreshSotdNow } = require('../services/sotdRefresher');
    const events = [];
    const originalActivity = logger.activity;
    logger.activity = (...args) => events.push(args);

    tycoon.resetSotdCacheForTests();
    tycoon.setSotdApiFetcher(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
            aptitude: 'fishing',
            short: 'Fish',
            skill: 'Fishing',
            bonus: 50,
        }),
        text: async () => '',
    }));

    try {
        await refreshSotdNow();
        await refreshSotdNow();
        assert.equal(events.filter(([type]) => type === 'sotd').length, 1);
    } finally {
        logger.activity = originalActivity;
        fs.rmSync(cacheDir, { recursive: true, force: true });
    }
});
