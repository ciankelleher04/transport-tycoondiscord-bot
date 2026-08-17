const express = require("express");
const Database = require("better-sqlite3");
const fs = require("node:fs");

const app = express();

const PORT = process.env.STATS_PORT || 3000;
const USERNAME = process.env.STATS_USERNAME;
const PASSWORD = process.env.STATS_PASSWORD;

const HEALTH_FILE = "/data/health.json";

const db = new Database("/data/stats.db", {
    readonly: true,
});

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="TT Tools Stats"'
        );

        return res.status(401).send("Authentication required.");
    }

    const encoded = authHeader.split(" ")[1];

    const decoded = Buffer
        .from(encoded, "base64")
        .toString("utf8");

    const separatorIndex = decoded.indexOf(":");

    const suppliedUsername =
        decoded.slice(0, separatorIndex);

    const suppliedPassword =
        decoded.slice(separatorIndex + 1);

    if (
        suppliedUsername !== USERNAME ||
        suppliedPassword !== PASSWORD
    ) {
        res.setHeader(
            "WWW-Authenticate",
            'Basic realm="TT Tools Stats"'
        );

        return res.status(401).send("Invalid login.");
    }

    next();
}

app.use(requireAuth);

app.get("/", (req, res) => {
    /*
     * =========================
     * Health information
     * =========================
     */

    let health = null;

    try {
        if (fs.existsSync(HEALTH_FILE)) {
            health = JSON.parse(
                fs.readFileSync(HEALTH_FILE, "utf8")
            );
        }
    } catch (error) {
        console.error(
            "[STATS WEB] Failed to read health file:",
            error
        );
    }

    let botOnline = false;
    let healthAgeSeconds = null;

    if (health?.updatedAt) {
        healthAgeSeconds = Math.floor(
            (
                Date.now() -
                new Date(health.updatedAt).getTime()
            ) / 1000
        );

        /*
         * If we haven't received a health update for
         * 90 seconds, consider the bot offline.
         */
        botOnline =
            health.online === true &&
            healthAgeSeconds <= 90;
    }

    const uptime = health
        ? formatUptime(health.uptimeSeconds)
        : "Unknown";

    const ping = health?.ping ?? "Unknown";
    const memoryMB = health?.memoryMB ?? "Unknown";
    const currentServers =
        health?.serverCount ?? "Unknown";

    const lastHealthUpdate = health?.updatedAt
        ? formatTimestamp(health.updatedAt)
        : "Never";

    /*
     * =========================
     * Command statistics
     * =========================
     */

    const totalCommands = db.prepare(`
        SELECT COUNT(*) AS count
        FROM command_usage
    `).get().count;

    const uniqueUsers = db.prepare(`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM command_usage
    `).get().count;

    const uniqueServers = db.prepare(`
        SELECT COUNT(DISTINCT guild_id) AS count
        FROM command_usage
        WHERE guild_id IS NOT NULL
    `).get().count;

    const commandsLast24h = db.prepare(`
        SELECT COUNT(*) AS count
        FROM command_usage
        WHERE timestamp >= datetime('now', '-1 day')
    `).get().count;

    const topCommands = db.prepare(`
        SELECT
            command,
            COUNT(*) AS count
        FROM command_usage
        GROUP BY command
        ORDER BY count DESC
        LIMIT 10
    `).all();

    const topServers = db.prepare(`
        SELECT
            guild_name,
            COUNT(*) AS count
        FROM command_usage
        WHERE guild_id IS NOT NULL
        GROUP BY guild_id, guild_name
        ORDER BY count DESC
        LIMIT 10
    `).all();

    const recentCommands = db.prepare(`
        SELECT
            timestamp,
            command,
            guild_name
        FROM command_usage
        ORDER BY id DESC
        LIMIT 20
    `).all();

    const topCommandRows = topCommands
        .map(
            row => `
                <tr>
                    <td>/${escapeHtml(row.command)}</td>
                    <td>${row.count}</td>
                </tr>
            `
        )
        .join("");

    const topServerRows = topServers
        .map(
            row => `
                <tr>
                    <td>${escapeHtml(row.guild_name ?? "Unknown")}</td>
                    <td>${row.count}</td>
                </tr>
            `
        )
        .join("");

    const recentRows = recentCommands
        .map(
            row => `
                <tr>
                    <td>${formatTimestamp(row.timestamp)}</td>
                    <td>/${escapeHtml(row.command)}</td>
                    <td>${escapeHtml(row.guild_name ?? "DM")}</td>
                </tr>
            `
        )
        .join("");

    const statusClass =
        botOnline ? "online" : "offline";

    const statusText =
        botOnline ? "Online" : "Offline";

    const statusIcon =
        botOnline ? "🟢" : "🔴";

    res.send(`
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <meta
        http-equiv="refresh"
        content="30"
    >

    <title>TT Tools Analytics</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 30px;
            font-family: Arial, sans-serif;
            background: #111318;
            color: #f4f4f4;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        h1 {
            margin-bottom: 5px;
        }

        .subtitle {
            color: #9ca3af;
            margin-bottom: 30px;
        }

        .health-card {
            background: #1b1f27;
            border-radius: 12px;
            padding: 22px;
            margin-bottom: 20px;
        }

        .health-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .health-title {
            font-size: 22px;
            font-weight: bold;
        }

        .status {
            font-weight: bold;
            font-size: 16px;
        }

        .online {
            color: #4ade80;
        }

        .offline {
            color: #f87171;
        }

        .health-grid {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(170px, 1fr));
            gap: 15px;
        }

        .health-item {
            background: #15181e;
            padding: 14px;
            border-radius: 8px;
        }

        .health-label {
            color: #9ca3af;
            font-size: 13px;
            margin-bottom: 6px;
        }

        .health-value {
            font-size: 18px;
            font-weight: bold;
        }

        .cards {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }

        .card {
            background: #1b1f27;
            border-radius: 12px;
            padding: 20px;
        }

        .card .label {
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 8px;
        }

        .card .value {
            font-size: 30px;
            font-weight: bold;
        }

        .grid {
            display: grid;
            grid-template-columns:
                repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
        }

        .panel {
            background: #1b1f27;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th,
        td {
            text-align: left;
            padding: 10px 8px;
            border-bottom: 1px solid #2b303a;
        }

        th {
            color: #9ca3af;
            font-size: 13px;
        }

        .footer {
            color: #6b7280;
            font-size: 13px;
            margin-top: 25px;
        }
    </style>
</head>

<body>

    <div class="container">

        <h1>TT Tools Analytics</h1>

        <div class="subtitle">
            Persistent command statistics
        </div>

        <div class="health-card">

            <div class="health-header">

                <div class="health-title">
                    🤖 Bot Health
                </div>

                <div class="status ${statusClass}">
                    ${statusIcon} ${statusText}
                </div>

            </div>

            <div class="health-grid">

                <div class="health-item">
                    <div class="health-label">
                        Uptime
                    </div>

                    <div class="health-value">
                        ${uptime}
                    </div>
                </div>

                <div class="health-item">
                    <div class="health-label">
                        Discord Ping
                    </div>

                    <div class="health-value">
                        ${ping} ms
                    </div>
                </div>

                <div class="health-item">
                    <div class="health-label">
                        Bot Memory
                    </div>

                    <div class="health-value">
                        ${memoryMB} MB
                    </div>
                </div>

                <div class="health-item">
                    <div class="health-label">
                        Connected Servers
                    </div>

                    <div class="health-value">
                        ${currentServers}
                    </div>
                </div>

                <div class="health-item">
                    <div class="health-label">
                        Last Health Update
                    </div>

                    <div class="health-value">
                        ${lastHealthUpdate}
                    </div>
                </div>

            </div>

        </div>

        <div class="cards">

            <div class="card">
                <div class="label">
                    Total Commands
                </div>

                <div class="value">
                    ${totalCommands}
                </div>
            </div>

            <div class="card">
                <div class="label">
                    Unique Users
                </div>

                <div class="value">
                    ${uniqueUsers}
                </div>
            </div>

            <div class="card">
                <div class="label">
                    Servers
                </div>

                <div class="value">
                    ${uniqueServers}
                </div>
            </div>

            <div class="card">
                <div class="label">
                    Commands Last 24h
                </div>

                <div class="value">
                    ${commandsLast24h}
                </div>
            </div>

        </div>

        <div class="grid">

            <div class="panel">

                <h2>Top Commands</h2>

                <table>

                    <thead>
                        <tr>
                            <th>Command</th>
                            <th>Uses</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${topCommandRows}
                    </tbody>

                </table>

            </div>

            <div class="panel">

                <h2>Top Servers</h2>

                <table>

                    <thead>
                        <tr>
                            <th>Server</th>
                            <th>Commands</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${topServerRows}
                    </tbody>

                </table>

            </div>

        </div>

        <div class="panel">

            <h2>Recent Commands</h2>

            <table>

                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Command</th>
                        <th>Server</th>
                    </tr>
                </thead>

                <tbody>
                    ${recentRows}
                </tbody>

            </table>

        </div>

        <div class="footer">
            TT Tools Analytics • Auto-refreshes every 30 seconds
        </div>

    </div>

</body>

</html>
    `);
});

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString("en-IE", {
        timeZone: "Europe/Dublin",
    });
}

function formatUptime(totalSeconds) {
    if (
        totalSeconds === undefined ||
        totalSeconds === null
    ) {
        return "Unknown";
    }

    const days =
        Math.floor(totalSeconds / 86400);

    const hours =
        Math.floor(
            (totalSeconds % 86400) / 3600
        );

    const minutes =
        Math.floor(
            (totalSeconds % 3600) / 60
        );

    const seconds =
        totalSeconds % 60;

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `[STATS WEB] Dashboard running on port ${PORT}`
    );
});