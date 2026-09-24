let discordClient = null;
const RECENT_ALERTS = new Map();
const ALERT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ALERTS_PER_WINDOW = 5;

function setClient(client) {
    discordClient = client;
}

function redactSecrets(value) {
    if (value === undefined || value === null) {
        return "";
    }

    let text = String(value);

    const patterns = [
        /(authorization\s*[:=]\s*)([^\s]+)/gi,
        /(x-tycoon-key\s*[:=]\s*)([^\s]+)/gi,
        /(discord[_-]?token\s*[:=]\s*)([^\s]+)/gi,
        /(token\s*[:=]\s*)([^\s]+)/gi,
        /(api[_-]?key\s*[:=]\s*)([^\s]+)/gi,
        /("token"\s*:\s*")([^"]+)/gi,
        /("api_key"\s*:\s*")([^"]+)/gi,
        /("X-Tycoon-Key"\s*:\s*")([^"]+)/gi,
    ];

    for (const pattern of patterns) {
        text = text.replace(pattern, (_, prefix) => `${prefix}[REDACTED]`);
    }

    return text;
}

function getAlertKey(level, message) {
    return `${level}:${String(message)
        .toLowerCase()
        .replace(/\s+/g, " ")
        .slice(0, 180)}`;
}

function shouldThrottle(level, message) {
    const key = getAlertKey(level, message);
    const now = Date.now();
    const current = RECENT_ALERTS.get(key) || {
        count: 0,
        lastAt: 0,
    };

    if (now - current.lastAt > ALERT_WINDOW_MS) {
        RECENT_ALERTS.set(key, {
            count: 1,
            lastAt: now,
        });

        return false;
    }

    current.count += 1;
    current.lastAt = now;
    RECENT_ALERTS.set(key, current);

    return current.count > MAX_ALERTS_PER_WINDOW;
}

async function sendToDiscord(level, message) {
    const channelId = process.env.LOG_CHANNEL_ID;

    if (!discordClient || !channelId) {
        return;
    }

    const sanitizedMessage = redactSecrets(message).slice(0, 1800);

    if (shouldThrottle(level, sanitizedMessage)) {
        return;
    }

    try {
        const channel = await discordClient.channels.fetch(channelId);

        if (!channel?.isTextBased()) {
            return;
        }

        await channel.send({
            content: `**[${level}]**\n\`\`\`\n${sanitizedMessage}\n\`\`\``,
        });
    } catch (error) {
        console.error("[LOGGER] Failed to send Discord log:", error);
    }
}

function info(message) {
    console.log(`[INFO] ${redactSecrets(message)}`);
}

function warn(message, meta = null) {
    const details = meta ? `\n${meta}` : "";
    const fullMessage = `${message}${details}`;

    console.warn(`[WARN] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("WARN", fullMessage);
}

function error(message, err = null) {
    const details = err?.stack ?? err?.message ?? err ?? "";
    const fullMessage = details
        ? `${message}\n${details}`
        : message;

    console.error(`[ERROR] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("ERROR", fullMessage);
}

function critical(message, err = null) {
    const details = err?.stack ?? err?.message ?? err ?? "";
    const fullMessage = details
        ? `${message}\n${details}`
        : message;

    console.error(`[CRITICAL] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("CRITICAL", fullMessage);
}

function important(message) {
    console.log(`[IMPORTANT] ${redactSecrets(message)}`);
    void sendToDiscord("INFO", message);
}

module.exports = {
    setClient,
    info,
    warn,
    error,
    critical,
    important,
};
