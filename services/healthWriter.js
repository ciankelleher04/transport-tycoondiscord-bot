const fs = require("node:fs");

const HEALTH_FILE = "/data/health.json";

function writeHealth(client) {
    try {
        const memoryUsage = process.memoryUsage().rss;

        const health = {
            online: client.isReady(),
            uptimeSeconds: Math.floor(process.uptime()),
            ping: client.ws.ping,
            memoryMB: Number(
                (memoryUsage / 1024 / 1024).toFixed(1)
            ),
            serverCount: client.guilds.cache.size,
            updatedAt: new Date().toISOString(),
        };

        fs.writeFileSync(
            HEALTH_FILE,
            JSON.stringify(health, null, 2),
            "utf8"
        );
    } catch (error) {
        console.error(
            "[HEALTH WRITER] Failed to update health file:",
            error
        );
    }
}

function startHealthWriter(client) {
    console.log("[HEALTH WRITER] Starting health updates...");

    /*
     * Write immediately when the bot starts.
     */
    writeHealth(client);

    /*
     * Then update every 30 seconds.
     */
    setInterval(() => {
        writeHealth(client);
    }, 30_000);
}

module.exports = {
    startHealthWriter,
};