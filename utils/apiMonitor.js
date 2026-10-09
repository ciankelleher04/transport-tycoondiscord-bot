const fs = require('node:fs');

const STATUS_FILE = '/data/tycoon-api-health.json';

function readStatus() {
    try {
        return JSON.parse(
            fs.readFileSync(STATUS_FILE, 'utf8')
        );
    } catch {
        return {
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastResult: 'unknown',
            lastSuccessfulServer: null,
            lastErrorType: null,
            servers: {},
        };
    }
}

function saveStatus(status) {
    try {
        const tempFile = `${STATUS_FILE}.${process.pid}.tmp`;

        fs.writeFileSync(
            tempFile,
            JSON.stringify(status, null, 2)
        );

        fs.renameSync(tempFile, STATUS_FILE);
    } catch (error) {
        console.error(
            '[API MONITOR] Failed to save status:',
            error.message
        );
    }
}

function recordServerResult(server, success, errorType = null) {
    const status = readStatus();
    const now = new Date().toISOString();

    status.servers ??= {};

    const serverStatus = status.servers[server] ?? {};

    serverStatus.lastResult = success ? 'success' : 'error';

    if (success) {
        serverStatus.lastSuccessAt = now;
        serverStatus.lastErrorType = null;
    } else {
        serverStatus.lastFailureAt = now;
        serverStatus.lastErrorType = errorType;
    }

    status.servers[server] = serverStatus;

    saveStatus(status);
}

function recordApiResult(success, server = null, errorType = null) {
    const status = readStatus();
    const now = new Date().toISOString();

    status.lastAttemptAt = now;
    status.lastResult = success ? 'success' : 'error';

    if (success) {
        status.lastSuccessAt = now;
        status.lastSuccessfulServer = server;
        status.lastErrorType = null;
    } else {
        status.lastFailureAt = now;
        status.lastErrorType = errorType;
    }

    saveStatus(status);
}

module.exports = {
    recordServerResult,
    recordApiResult,
};
