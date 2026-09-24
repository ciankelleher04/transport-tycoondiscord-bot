// Load environment variables
require("dotenv").config();

// Import Discord.js classes
const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const logger = require("./services/logger");

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const { startStreakRefresher } =
    require("./services/streakRefresher");

const { startStreakReminderChecker } =
    require("./services/reminders");

const { startHealthWriter } =
    require("./services/healthWriter");

function startKumaHeartbeat() {
    const pushUrls = [
        process.env.KUMA_PUSH_URL,
        process.env.KUMA_OVERALL_PUSH_URL,
    ].filter(Boolean);

    if (pushUrls.length === 0) {
        logger.info("[KUMA] No push URLs are configured; heartbeat disabled.");
        return;
    }

    const sendHeartbeat = async () => {
        for (const pushUrl of pushUrls) {
            try {
                const response = await fetch(pushUrl);
                if (!response.ok) {
                    logger.warn(
                        `[KUMA] Heartbeat failed with HTTP ${response.status}`,
                        { service: 'kuma-heartbeat', pushUrl }
                    );
                }
            } catch (error) {
                logger.error("[KUMA] Heartbeat failed:", error, {
                    service: 'kuma-heartbeat',
                    pushUrl,
                });
            }
        }
    };

    sendHeartbeat();
    setInterval(sendHeartbeat, 60_000);
}

const {
    loadUsers,
    saveUsers,
} = require("./utils/tycoon");

const { logCommandUsage } = require("./utils/stats");

client.commands = new Collection();

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

client.once("ready", () => {
    // Set the client before emitting startup logs so they can reach Discord.
    logger.setClient(client);

    logger.info("Bot is ready!");
    logger.info(`Logged in as ${client.user.tag}`);
    logger.important(`Bot logged in as ${client.user.tag}`);

    startStreakRefresher(client);
    startStreakReminderChecker(client);
    startHealthWriter(client);
    startKumaHeartbeat();
});

client.on("interactionCreate", async interaction => {
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

            user.streakNotifications = interaction.values;
            saveUsers(users);

            const count = interaction.values.length;

            logger.info(
                `[STREAK SETTINGS] ${interaction.user.tag} (${interaction.user.id}) enabled ${count} streak notification jobs.`,
                {
                    service: 'streak-settings',
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    guildId: interaction.guild?.id,
                    guildName: interaction.guild?.name ?? 'DM',
                }
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

    if (!interaction.isChatInputCommand()) return;

    const timestamp = new Date().toLocaleTimeString("en-IE", {
        hour12: false,
    });

    logger.info(
        `[${timestamp}] [COMMAND] /${interaction.commandName} | User: ${interaction.user.tag} (${interaction.user.id}) | Server: ${interaction.guild?.name || "DM"}`,
        {
            service: 'discord-command',
            command: interaction.commandName,
            userId: interaction.user.id,
            userTag: interaction.user.tag,
            guildId: interaction.guild?.id,
            guildName: interaction.guild?.name ?? 'DM',
        }
    );

    logCommandUsage(interaction);

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(
            `Command /${interaction.commandName} failed for ${interaction.user.tag}`,
            error,
            {
                service: 'discord-command',
                command: interaction.commandName,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                guildId: interaction.guild?.id,
                guildName: interaction.guild?.name ?? 'DM',
                channelId: interaction.channelId,
            }
        );

        const errorMessage = {
            content: "There was an error while running this command.",
            ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

process.on("unhandledRejection", error => {
    logger.critical("Unhandled promise rejection", error, {
        service: 'process',
    });
});

process.on("uncaughtException", error => {
    logger.critical("Uncaught exception", error, {
        service: 'process',
    });
});

client.login(process.env.TOKEN);
