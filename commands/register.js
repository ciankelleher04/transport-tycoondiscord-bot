const { SlashCommandBuilder } = require('discord.js');
const { loadUsers, saveUsers } = require('../utils/tycoon');

const BASE_API_URL = 'https://api.tycoon.community';



module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register your private API key here')
        .addStringOption(option =>
            option
                .setName('api_key')
                .setDescription('Your private API key')
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const apiKey = interaction.options.getString('api_key');
        const discordId = interaction.user.id;

        try {
            const userResponse = await fetch(`${BASE_API_URL}/snowflake2user/${discordId}`, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!userResponse.ok) {
                return interaction.editReply(
                    `Could not find your Transport Tycoon account from your Discord ID.\nAPI error: ${userResponse.status} ${userResponse.statusText}`
                );
            }

            const userData = await userResponse.json();
            console.log('snowflake2user response:', userData);

            const tycoonUserId =
                userData.user_id ??
                userData.id ??
                userData.data?.user_id ??
                userData.data?.id;

            if (!tycoonUserId) {
                return interaction.editReply(
                    'The API worked, but I could not find the Tycoon user ID in the response. Check the bot logs.'
                );
            }

            const testResponse = await fetch(`${BASE_API_URL}/data/${tycoonUserId}`, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            if (!testResponse.ok) {
                return interaction.editReply(
                    `I found your Tycoon user ID (${tycoonUserId}), but could not fetch your data.\nAPI error: ${testResponse.status} ${testResponse.statusText}`
                );
            }

            const users = loadUsers();

            users[discordId] = {
                discordId,
                tycoonUserId,
                apiKey,
                registeredAt: new Date().toISOString(),
            };

            saveUsers(users);

            await interaction.editReply(
                `Registered successfully.\nTycoon user ID: ${tycoonUserId}`
            );
        } catch (error) {
            console.error('Register command failed:', error);

            await interaction.editReply(
                'Something went wrong while registering. Check the bot logs.'
            );
        }
    },
};