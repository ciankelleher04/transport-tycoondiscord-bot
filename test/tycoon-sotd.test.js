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
process.env.SOTD_RETRY_DELAYS_MS = '0';
process.env.SOTD_FAILURE_COOLDOWN_MS = '10';

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
    assert.equal(second.skill, first.skill);
    assert.equal(second.bonus, first.bonus);
    assert.equal(second.source, 'cache');
    assert.equal(second.refreshConfirmed, false);
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

test('shares one controlled initial retrieval across concurrent cache misses', async () => {
    let calls = 0;
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return response({
            aptitude: 'fishing',
            short: 'Fish',
            skill: 'Fishing',
            bonus: 50,
        });
    });

    const results = await Promise.all([
        tycoon.fetchSotd(),
        tycoon.fetchSotd(),
        tycoon.fetchSotd(),
    ]);

    assert.equal(calls, 1);
    assert.ok(results.every(result => result.status === 'confirmed'));
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

test('backs off repeated outage calls and recovers after the cooldown', async () => {
    let calls = 0;
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        return response({}, false, 503);
    });

    await assert.rejects(tycoon.fetchSotd());
    await assert.rejects(tycoon.fetchSotd(), /cooldown is active/);
    assert.equal(calls, 2);

    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        return response({
            aptitude: 'fishing',
            short: 'Fish',
            skill: 'Fishing',
            bonus: 50,
        });
    });

    await new Promise(resolve => setTimeout(resolve, 15));
    const recovered = await tycoon.fetchSotd();

    assert.equal(recovered.status, 'confirmed');
    assert.equal(calls, 3);
});

test('preserves a confirmed current-day cache when manual refresh fails', async () => {
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => response({
        aptitude: 'fishing',
        short: 'Fish',
        skill: 'Fishing',
        bonus: 50,
    }));

    const confirmed = await tycoon.fetchSotd();
    tycoon.setSotdApiFetcher(async () => response({}, false, 503));

    await assert.rejects(tycoon.fetchSotd(true));

    assert.deepEqual(tycoon.getStoredSotd().skill, confirmed.skill);
    assert.equal(JSON.parse(fs.readFileSync(cacheFile)).status, 'confirmed');
});

test('does not treat a previous-day cache as current', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);

    fs.writeFileSync(cacheFile, JSON.stringify({
        current: {
            sotd: {
                aptitude: 'fishing',
                short: 'Fish',
                skill: 'Fishing',
                bonus: 50,
            },
            dayKey: yesterday,
            refreshedAt: new Date().toISOString(),
            status: 'confirmed',
        },
        lastKnown: {
            aptitude: 'fishing',
            short: 'Fish',
            skill: 'Fishing',
            bonus: 50,
            dayKey: yesterday,
            status: 'confirmed',
        },
        status: 'confirmed',
    }));

    const restored = loadFreshTycoon();
    assert.equal(restored.getStoredSotd(), null);
});

test('limits automatic refreshes to three rounds with two endpoint requests each', async () => {
    let calls = 0;
    tycoon.resetSotdCacheForTests();
    fs.rmSync(cacheFile, { force: true });
    tycoon.setSotdApiFetcher(async () => {
        calls += 1;
        return response({}, false, 503);
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
        await assert.rejects(tycoon.fetchSotd());
        await new Promise(resolve => setTimeout(resolve, 15));
    }

    await assert.rejects(
        tycoon.fetchSotd(),
        /automatic refresh budget is exhausted/
    );
    assert.equal(calls, 6);
    assert.equal(tycoon.getSotdAutomaticState().attempts, 3);
});

test('uses the three UTC scheduled rounds and no recurring polling', () => {
    const { SOTD_SCHEDULES } = require('../services/sotdRefresher');

    assert.deepEqual(
        SOTD_SCHEDULES.map(schedule => schedule.expression),
        ['15 0 * * *', '45 0 * * *', '15 1 * * *']
    );
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
