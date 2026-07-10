//Load environment variables
require("dotenv").config();

//import Discord.js classes
const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});
const { startStreakRefresher } = require("./services/streakRefresher");

client.commands = new Collection();

//import commands
const pingCommand = require("./commands/ping");
const commandsCommand = require("./commands/commands");
const fishxpCommand = require("./commands/fishxp");
const bearxpCommand = require("./commands/bearxp");
const streakstatus = require("./commands/streakstatus");
const register = require("./commands/register");
const { startStreakReminderChecker } = require("./services/reminders");
const logger = require('./services/logger');

const activeCommands = [
    pingCommand,
    commandsCommand,
    fishxpCommand,
    bearxpCommand,
    streakstatus,
    register,
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

    console.log(require("fs").readdirSync("/"));
    startStreakRefresher();
    startStreakReminderChecker(client);
});

// Handles slash command interactions
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const timestamp = new Date().toLocaleTimeString("en-IE", {
        hour12: false,
    });

    console.log(
        `[${timestamp}] [COMMAND] /${interaction.commandName} | User: ${interaction.user.tag} (${interaction.user.id}) | Server: ${interaction.guild?.name || "DM"}`
    );
    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(
            `Command /${interaction.commandName} failed for ${interaction.user.tag}`,
            error
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

process.on('unhandledRejection', error => {
    logger.error('Unhandled promise rejection', error);
});

process.on('uncaughtException', error => {
    logger.error('Uncaught exception', error);
});

// Log in to discord
client.login(process.env.TOKEN);