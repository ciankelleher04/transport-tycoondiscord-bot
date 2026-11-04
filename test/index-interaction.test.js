const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-index-'));
process.env.STATS_DB_FILE = path.join(tempDir, 'stats.db');
process.env.ACTIVITY_LOG_CHANNEL_ID = '';

const { client, handleInteraction } = require('../index');
const logger = require('../services/logger');

test.after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
});

test('slash-command handling emits command activity, but dropdowns do not', async () => {
    const activityEvents = [];
    const originalActivity = logger.activity;
    logger.activity = (...args) => activityEvents.push(args);

    client.commands.set('testcommand', {
        execute: async () => {},
    });

    const baseInteraction = {
        user: { id: 'user-1', tag: 'Tester' },
        guild: { id: 'guild-1', name: 'Test Server' },
        channelId: 'channel-1',
        isStringSelectMenu: () => false,
        isAutocomplete: () => false,
        isChatInputCommand: () => true,
        commandName: 'testcommand',
    };

    try {
        await handleInteraction(baseInteraction);

        assert.equal(activityEvents.length, 1);
        assert.deepEqual(activityEvents[0], [
            'command',
            'Command Executed',
            {
                Command: '/testcommand',
                User: 'Tester',
                'User ID': 'user-1',
                Location: 'Test Server',
                Time: activityEvents[0][2].Time,
            },
        ]);

        await handleInteraction({
            ...baseInteraction,
            isStringSelectMenu: () => true,
            isChatInputCommand: () => false,
            customId: 'other_dropdown',
            values: [],
        });

        assert.equal(activityEvents.length, 1);
    } finally {
        logger.activity = originalActivity;
    }
});
