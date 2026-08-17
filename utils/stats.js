const Database = require('better-sqlite3');
const path = require('node:path');

const DB_FILE = path.join('/data', 'stats.db');

const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');

db.prepare(`
    CREATE TABLE IF NOT EXISTS command_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        command TEXT NOT NULL,
        user_id TEXT NOT NULL,
        guild_id TEXT,
        guild_name TEXT
    )
`).run();

const insertUsage = db.prepare(`
    INSERT INTO command_usage (
        timestamp,
        command,
        user_id,
        guild_id,
        guild_name
    )
    VALUES (?, ?, ?, ?, ?)
`);

function logCommandUsage(interaction) {
    insertUsage.run(
        new Date().toISOString(),
        interaction.commandName,
        interaction.user.id,
        interaction.guild?.id ?? null,
        interaction.guild?.name ?? null
    );
}

function getTotalCommands() {
    return db.prepare(`
        SELECT COUNT(*) AS count
        FROM command_usage
    `).get().count;
}

function getCommandCounts() {
    return db.prepare(`
        SELECT
            command,
            COUNT(*) AS count
        FROM command_usage
        GROUP BY command
        ORDER BY count DESC
    `).all();
}

function getUniqueUsers() {
    return db.prepare(`
        SELECT COUNT(DISTINCT user_id) AS count
        FROM command_usage
    `).get().count;
}

function getUniqueServers() {
    return db.prepare(`
        SELECT COUNT(DISTINCT guild_id) AS count
        FROM command_usage
        WHERE guild_id IS NOT NULL
    `).get().count;
}

function getServerCommandCount(guildId) {
    return db.prepare(`
        SELECT COUNT(*) AS count
        FROM command_usage
        WHERE guild_id = ?
    `).get(guildId).count;
}

module.exports = {
    logCommandUsage,
    getTotalCommands,
    getCommandCounts,
    getUniqueUsers,
    getUniqueServers,
    getServerCommandCount,
};