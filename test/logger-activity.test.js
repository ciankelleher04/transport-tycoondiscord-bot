const assert = require('node:assert/strict');
const test = require('node:test');

const logger = require('../services/logger');

test('activity logging is opt-in for operational events and redacts secrets', async () => {
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
