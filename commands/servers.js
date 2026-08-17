const {
    SlashCommandBuilder,
    EmbedBuilder,
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("servers")
        .setDescription("Show the servers TT Tools is connected to"),

    async execute(interaction) {
        if (interaction.user.id !== process.env.ADMIN_USER_ID) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true,
            });
        }

        await interaction.deferReply({
            ephemeral: true,
        });

        const guilds = [...interaction.client.guilds.cache.values()];

        if (guilds.length === 0) {
            return interaction.editReply({
                content: "The bot is not connected to any servers.",
            });
        }

        const serverEntries = [];

        for (const guild of guilds) {
            let ownerName = "Unknown";
            let ownerId = guild.ownerId ?? "Unknown";

            try {
                const owner = await guild.fetchOwner();

                ownerName = owner.user.tag;
                ownerId = owner.id;
            } catch (error) {
                console.error(
                    `[SERVERS] Failed to fetch owner for ${guild.name}:`,
                    error.message
                );
            }

            const joinedTimestamp = guild.joinedTimestamp;

            const joinedText = joinedTimestamp
                ? `<t:${Math.floor(joinedTimestamp / 1000)}:R>`
                : "Unknown";

            serverEntries.push(
                [
                    `**${guild.name}**`,
                    `Owner: **${ownerName}**`,
                    `Owner ID: \`${ownerId}\``,
                    `Members: **${guild.memberCount}**`,
                    `Server ID: \`${guild.id}\``,
                    `Bot joined: ${joinedText}`,
                ].join("\n")
            );
        }

        const serverList = serverEntries.join("\n\n");

        const embed = new EmbedBuilder()
            .setTitle(
                `🖥️ TT Tools Servers (${interaction.client.guilds.cache.size})`
            )
            .setDescription(serverList)
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
        });
    },
};