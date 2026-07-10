let discordClient = null;

function setClient(client) {
    discordClient = client;
}

async function sendToDiscord(level, message) {
    const channelId = process.env.LOG_CHANNEL_ID;

    if (!discordClient || !channelId) {
        return;
    }

    try {
        const channel = await discordClient.channels.fetch(channelId);

        if (!channel?.isTextBased()) {
            return;
        }

        const safeMessage = String(message).slice(0, 1800);

        await channel.send({
            content: `**[${level}]**\n\`\`\`\n${safeMessage}\n\`\`\``,
        });
    } catch (error) {
        console.error('[LOGGER] Failed to send Discord log:', error);
    }
}

function info(message) {
    console.log(`[INFO] ${message}`);
}

function warn(message) {
    console.warn(`[WARN] ${message}`);
    void sendToDiscord('WARN', message);
}

function error(message, err = null) {
    const details = err?.stack ?? err?.message ?? err ?? '';
    const fullMessage = details
        ? `${message}\n${details}`
        : message;

    console.error(`[ERROR] ${fullMessage}`);
    void sendToDiscord('ERROR', fullMessage);
}

function important(message) {
    console.log(`[IMPORTANT] ${message}`);
    void sendToDiscord('INFO', message);
}

module.exports = {
    setClient,
    info,
    warn,
    error,
    important,
};