// Load environment variables
require("dotenv").config();

// Import Discord.js classes
const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const { startStreakRefresher } =
    require("./services/streakRefresher");

const { startStreakReminderChecker } =
    require("./services/reminders");

const { startHealthWriter } =
    require("./services/healthWriter");

const {
    loadUsers,
    saveUsers,
} = require("./utils/tycoon");

const logger = require("./services/logger");
const { logCommandUsage } = require("./utils/stats");

client.commands = new Collection();

// Import commands
const pingCommand = require("./commands/ping");
const commandsCommand = require("./commands/commands");
const fishxpCommand = require("./commands/fishxp");
const bearxpCommand = require("./commands/bearxp");
const streakstatus = require("./commands/streakstatus");
const streaksettings = require("./commands/streaksettings");
const register = require("./commands/register");
const healthCommand = require("./commands/health");
const restartCommand = require("./commands/restartbot");
const statsCommand = require("./commands/stats");
const serversCommand = require("./commands/servers");
const suggestCommand = require("./commands/suggest");
const refreshSotdCommand = require("./commands/refreshsotd");
const unregisterCommand = require("./commands/unregister");

const activeCommands = [
    pingCommand,
    commandsCommand,
    fishxpCommand,
    bearxpCommand,
    streakstatus,
    streaksettings,
    register,
    healthCommand,
    restartCommand,
    statsCommand,
    serversCommand,
    suggestCommand,
    refreshSotdCommand,
    unregisterCommand,
];

for (const command of activeCommands) {
    client.commands.set(command.data.name, command);
}

// Runs once bot is ready to be used
client.once("clientReady", () => {
    console.log("Bot is ready!");
    console.log(`Logged in as ${client.user.tag}`);

    logger.setClient(client);
    logger.important(`Bot logged in as ${client.user.tag}`);

    startStreakRefresher(client);
    startStreakReminderChecker(client);
    startHealthWriter(client);
});

// Handles Discord interactions
client.on("interactionCreate", async interaction => {

    /*
     * =========================
     * STREAK SETTINGS MENU
     * =========================
     */
    if (interaction.isStringSelectMenu()) {
        if (
            interaction.customId ===
            "streak_notification_settings"
        ) {
            const users = loadUsers();
            const user = users[interaction.user.id];

            if (!user) {
                return interaction.reply({
                    content:
                        "You are not registered yet. Use `/register` first.",
                    ephemeral: true,
                });
            }

            /*
             * interaction.values contains the selected job keys.
             *
             * Example:
             * ["hunter", "deadliest", "mechanic"]
             */
            user.streakNotifications =
                interaction.values;

            saveUsers(users);

            const count =
                interaction.values.length;

            console.log(
                `[STREAK SETTINGS] ${interaction.user.tag} (${interaction.user.id}) enabled ${count} streak notification jobs.`
            );

            return interaction.update({
                content:
                    count === 0
                        ? "🔕 All streak notifications have been disabled."
                        : `✅ Streak notifications updated. You have **${count}** job${count === 1 ? "" : "s"} enabled.`,
                embeds: [],
                components: [],
            });
        }

        return;
    }

    /*
     * =========================
     * SLASH COMMANDS
     * =========================
     */
    if (!interaction.isChatInputCommand()) return;

    const timestamp = new Date().toLocaleTimeString(
        "en-IE",
        {
            hour12: false,
        }
    );

    console.log(
        `[${timestamp}] [COMMAND] /${interaction.commandName} | User: ${interaction.user.tag} (${interaction.user.id}) | Server: ${interaction.guild?.name || "DM"}`
    );

    logCommandUsage(interaction);

    const command =
        client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(
            `Command /${interaction.commandName} failed for ${interaction.user.tag}`,
            error
        );

        const errorMessage = {
            content:
                "There was an error while running this command.",
            ephemeral: true,
        };

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            await interaction.followUp(
                errorMessage
            );
        } else {
            await interaction.reply(
                errorMessage
            );
        }
    }
});

process.on("unhandledRejection", error => {
    logger.error(
        "Unhandled promise rejection",
        error
    );
});

process.on("uncaughtException", error => {
    logger.error(
        "Uncaught exception",
        error
    );
});

// Log in to Discord
client.login(process.env.TOKEN);