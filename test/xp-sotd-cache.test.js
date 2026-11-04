const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-xp-cache-'));
process.env.TYCOON_API_KEY = 'test-key';
process.env.SOTD_CACHE_FILE = path.join(cacheDir, 'sotd.json');

const tycoon = require('../utils/tycoon');
const bearxp = require('../commands/bearxp');
const fishxp = require('../commands/fishxp');

function interaction(commandName) {
    const values = {
        target: '1000000',
        current_xp: 0,
        base_xp: 0,
        bonus_xp: false,
        bonus_xp_amount: 0,
    };

    return {
        user: { id: 'user-1', tag: 'Tester' },
        guild: null,
        client: {
            user: {
                username: 'TT Tools',
                displayAvatarURL: () => 'https://example.test/avatar.png',
            },
        },
        options: {
            getString: name => values[name],
            getInteger: name => values[name],
            getNumber: name => values[name],
            getBoolean: name => values[name],
        },
        deferReply: async () => {},
        editReply: async reply => reply,
        commandName,
    };
}

test.after(() => {
    fs.rmSync(cacheDir, { recursive: true, force: true });
});

test('XP commands use cache only and do not consume API attempts when SOTD is missing', async () => {
    let apiCalls = 0;
    tycoon.resetSotdCacheForTests();
    fs.rmSync(process.env.SOTD_CACHE_FILE, { force: true });
    tycoon.setSotdApiFetcher(async () => {
        apiCalls += 1;
        throw new Error('API must not be called by XP commands');
    });

    const bearReply = await bearxp.execute(interaction('bearxp'));
    const fishReply = await fishxp.execute(interaction('fishxp'));

    assert.equal(apiCalls, 0);
    assert.ok(
        bearReply.embeds[0].data.fields.some(field =>
            field.name.includes('SOTD Bonus')
        )
    );
    assert.ok(
        fishReply.embeds[0].data.fields.some(field =>
            field.name.includes('SOTD Bonus')
        )
    );
    assert.equal(tycoon.getSotdAutomaticState().attempts, 0);
});
