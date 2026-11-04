const { EmbedBuilder } = require("discord.js");

let discordClient = null;
const RECENT_ALERTS = new Map();
const RECENT_ACTIVITY = new Map();
const ACTIVITY_SEND_QUEUE = [];
let activitySendInProgress = false;
const ALERT_WINDOW_MS = 5 * 60 * 1000;
const MAX_ALERTS_PER_WINDOW = 5;
const ACTIVITY_WINDOW_MS = 30 * 1000;

function configuredActivityEvents() {
    return new Set(
        (process.env.ACTIVITY_LOG_EVENTS ?? "command,sotd")
            .split(",")
            .map(event => event.trim().toLowerCase())
            .filter(Boolean)
    );
}

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

function formatContext(context) {
    if (!context || typeof context !== "object") {
        return "";
    }

    const entries = Object.entries(context)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${redactSecrets(value)}`);

    return entries.length > 0
        ? `\nContext: ${entries.join(" | ")}`
        : "";
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

function formatActivityFields(fields = {}) {
    return Object.entries(fields)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([name, value]) => ({
            name: String(name).slice(0, 256),
            value: redactSecrets(value).slice(0, 1024),
            inline: true,
        }))
        .slice(0, 25);
}

function activityIsThrottled(eventType, fields) {
    const key = `${eventType}:${JSON.stringify(fields)}`;
    const now = Date.now();
    const lastAt = RECENT_ACTIVITY.get(key) ?? 0;

    if (now - lastAt < ACTIVITY_WINDOW_MS) {
        return true;
    }

    RECENT_ACTIVITY.set(key, now);
    return false;
}

async function drainActivityQueue() {
    if (activitySendInProgress || ACTIVITY_SEND_QUEUE.length === 0) {
        return;
    }

    activitySendInProgress = true;
    const { embed } = ACTIVITY_SEND_QUEUE.shift();

    try {
        const channelId = process.env.ACTIVITY_LOG_CHANNEL_ID;
        const channel = await discordClient?.channels.fetch(channelId);

        if (channel?.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error("[LOGGER] Failed to send Discord activity:", error);
    } finally {
        activitySendInProgress = false;
        void drainActivityQueue();
    }
}

function activity(eventType, title, fields = {}) {
    const channelId = process.env.ACTIVITY_LOG_CHANNEL_ID;

    if (
        !discordClient ||
        !channelId ||
        !configuredActivityEvents().has(eventType.toLowerCase()) ||
        activityIsThrottled(eventType, fields)
    ) {
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`TT Tools — ${title}`)
        .setColor("#5865F2")
        .setTimestamp()
        .addFields(formatActivityFields(fields));

    ACTIVITY_SEND_QUEUE.push({ embed });
    void drainActivityQueue();
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

function info(message, context = null) {
    const fullMessage = `${message}${formatContext(context)}`;
    console.log(`[INFO] ${redactSecrets(fullMessage)}`);
}

function warn(message, context = null) {
    const fullMessage = `${message}${formatContext(context)}`;

    console.warn(`[WARN] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("WARN", fullMessage);
}

function error(message, err = null, context = null) {
    const details = err?.stack ?? err?.message ?? err ?? "";
    const fullMessage = `${message}${formatContext(context)}${details ? `\n${details}` : ""}`;

    console.error(`[ERROR] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("ERROR", fullMessage);
}

function critical(message, err = null, context = null) {
    const details = err?.stack ?? err?.message ?? err ?? "";
    const fullMessage = `${message}${formatContext(context)}${details ? `\n${details}` : ""}`;

    console.error(`[CRITICAL] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("CRITICAL", fullMessage);
}

function important(message, context = null) {
    const fullMessage = `${message}${formatContext(context)}`;
    console.log(`[IMPORTANT] ${redactSecrets(fullMessage)}`);
    void sendToDiscord("INFO", fullMessage);
}

module.exports = {
    setClient,
    info,
    warn,
    error,
    critical,
    important,
    activity,
};
