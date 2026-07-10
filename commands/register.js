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

            const streakResponse = await fetch(`${BASE_API_URL}/streak/${tycoonUserId}`, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
            });

            let streakData = null;

            if (streakResponse.ok) {
                const streakResult = await streakResponse.json();

                console.log('Initial streak response:', streakResult);

                streakData = {
                    days: streakResult.data?.days ?? 0,
                    record: streakResult.data?.record ?? 0,
                    streak: streakResult.data?.streak ?? 0,
                    lastChecked: new Date().toISOString(),
                };
            } else {
                console.error(
                    `Initial streak check failed: ${streakResponse.status} ${streakResponse.statusText}`
                );
            }

            users[discordId] = {
                discordId,
                tycoonUserId,
                apiKey,
                registeredAt: new Date().toISOString(),
                streak: streakData,
            };

            saveUsers(users);

            await interaction.editReply(
                `Registered successfully.\n` +
                `Tycoon user ID: ${tycoonUserId}\n` +
                (streakData
                    ? `Current streak: ${streakData.streak} days`
                    : 'Your key was saved, but the initial streak check failed.')
            );
        } catch (error) {
            console.error('Register command failed:', error);

            await interaction.editReply(
                'Something went wrong while registering. Check the bot logs.'
            );
        }
    },
};