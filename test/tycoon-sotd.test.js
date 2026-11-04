const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cacheFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'tt-sotd-')),
    'sotd.json'
);

process.env.TYCOON_API_KEY = 'test-key';
process.env.SOTD_CACHE_FILE = cacheFile;

const tycoonPath = require.resolve('../utils/tycoon');
let tycoon = require(tycoonPath);

function response(data, ok = true, status = 200) {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Unavailable',
        json: async () => data,
        text: async () => 'failure',
    };
}

function loadFreshTycoon() {
    delete require.cache[tycoonPath];
    tycoon = require(tycoonPath);
    return tycoon;
}

test.after(() => {
    fs.rmSync(path.dirname(cacheFile), { recursive: true, force: true });
});

test('caches one confirmed SOTD for the current day', async () => {
    let calls = 0;
    tycoon.resetSotdCacheForTests();
    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        return response({
            aptitude: 'fishing',
            short: 'Fish',
            skill: 'Fishing',
            bonus: 50,
        });
    });

    const first = await tycoon.fetchSotd();
    const second = await tycoon.fetchSotd();

    assert.equal(calls, 1);
    assert.deepEqual(second, first);
    const persisted = JSON.parse(fs.readFileSync(cacheFile));
    assert.equal(persisted.status, 'confirmed');
    assert.ok(persisted.lastSuccessfulRefreshAt);
});

test('shares concurrent refreshes and supports manual refresh', async () => {
    let calls = 0;
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return response({
            aptitude: 'skill',
            short: 'Bear',
            skill: 'Skill',
            bonus: 25,
        });
    });

    await Promise.all([
        tycoon.fetchSotd(true),
        tycoon.fetchSotd(true),
        tycoon.fetchSotd(true),
    ]);

    assert.equal(calls, 1);
    await tycoon.fetchSotd(true);
    assert.equal(calls, 2);
});

test('restores a confirmed SOTD after a module restart', async () => {
    tycoon.resetSotdCacheForTests();
    const restored = loadFreshTycoon();
    let calls = 0;
    restored.setSotdApiFetcher(async () => {
        calls += 1;
        return response({});
    });

    const sotd = await restored.fetchSotd();

    assert.equal(sotd.status, 'confirmed');
    assert.equal(calls, 0);
});

test('does not use yesterday as a confirmed current SOTD after refresh failure', async () => {
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => response({}, false, 503));

    await assert.rejects(tycoon.fetchSotd(true));

    const persisted = JSON.parse(fs.readFileSync(cacheFile));
    assert.equal(persisted.current, null);
    assert.equal(persisted.status, 'unavailable');
    assert.equal(tycoon.getStoredSotd(), null);
});

test('rollover delay maps 00:00 UTC to the previous SOTD day', () => {
    const RealDate = Date;
    const fakeNow = new RealDate('2026-11-04T00:10:00.000Z').getTime();

    global.Date = class extends RealDate {
        constructor(...args) {
            super(...(args.length ? args : [fakeNow]));
        }

        static now() {
            return fakeNow;
        }
    };

    try {
        assert.equal(tycoon.getSotdDayKey(), '2026-11-03');
    } finally {
        global.Date = RealDate;
    }
});
