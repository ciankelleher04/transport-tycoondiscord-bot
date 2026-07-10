const {
    SlashCommandBuilder,
    ApplicationIntegrationType,
    InteractionContextType,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("commands")
        .setDescription("Get a list of all available commands")
        .setIntegrationTypes(
            ApplicationIntegrationType.GuildInstall,
            ApplicationIntegrationType.UserInstall
        )
        .setContexts(
            InteractionContextType.Guild,
            InteractionContextType.BotDM,
            InteractionContextType.PrivateChannel
        ),

    async execute(interaction) {
        // Command logic here
        try {
            await interaction.reply(
                `🏓 /ping - Check if the bot is online.
    🎲 /roll - Roll a custom dice.
    /coinflip - Heads or Tails.
    🎱 /8ball - Ask the Magic 8-Ball a question.
    /choose - Choose between 1 thing or another (up to 4 options).
    /commands - Display all available commands.
    🐻 /bearxp - Calculate how many bears are required for a target XP.
🎣 /fishxp - Calculate how much fish is required for a target XP.
👤 /userinfo - Display information about a user.
🏠 /serverinfo - Display information about the server.
🔢 /randomnumber - Pick a random number between two numbers.
    `);
        } catch (error) {
            console.error(error);
        }
    },
};
