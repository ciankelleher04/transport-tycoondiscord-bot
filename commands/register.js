const { SlashCommandBuilder } = require('discord.js');
const { loadUsers, saveUsers } = require('../utils/tycoon');
const logger = require('../services/logger');

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
        const context = {
            service: 'registration',
            command: 'register',
            userId: discordId,
            userTag: interaction.user.tag,
            guildId: interaction.guild?.id,
            guildName: interaction.guild?.name ?? 'DM',
        };

        try {
            const userResponse = await fetch(`${BASE_API_URL}/snowflake2user/${discordId}`, {
                method: 'GET',
                headers: {
                    'X-Tycoon-Key': apiKey,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10_000),
            });

            if (!userResponse.ok) {
                logger.warn(
                    '[REGISTER] Could not resolve Discord user through Tycoon API.',
                    { ...context, status: userResponse.status }
                );

                return interaction.editReply(
                    `Could not find your Transport Tycoon account from your Discord ID.\nAPI error: ${userResponse.status} ${userResponse.statusText}`
                );
            }

            const userData = await userResponse.json();

            const tycoonUserId =
                userData.user_id ??
                userData.id ??
                userData.data?.user_id ??
                userData.data?.id;

            if (!tycoonUserId) {
                logger.error(
                    '[REGISTER] Tycoon response did not contain a user ID.',
                    null,
                    context
                );

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
                signal: AbortSignal.timeout(10_000),
            });

            if (!testResponse.ok) {
                logger.warn(
                    '[REGISTER] Tycoon data validation failed.',
                    { ...context, tycoonUserId, status: testResponse.status }
                );

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
                signal: AbortSignal.timeout(10_000),
            });

            let streakData = null;

            if (streakResponse.ok) {
                const streakResult = await streakResponse.json();

                streakData = {
                    days: streakResult.data?.days ?? 0,
                    record: streakResult.data?.record ?? 0,
                    streak: streakResult.data?.streak ?? 0,
                    lastChecked: new Date().toISOString(),
                };
            } else {
                logger.warn(
                    '[REGISTER] Initial streak check failed; continuing registration.',
                    { ...context, tycoonUserId, status: streakResponse.status }
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

            logger.info(
                '[REGISTER] User registered successfully.',
                { ...context, tycoonUserId, initialStreakLoaded: Boolean(streakData) }
            );

            await interaction.editReply(
                `Registered successfully.\n` +
                `Tycoon user ID: ${tycoonUserId}\n` +
                (streakData
                    ? `Current streak: ${streakData.streak} days`
                    : 'Your key was saved, but the initial streak check failed.')
            );
        } catch (error) {
            logger.error('[REGISTER] Register command failed.', error, context);

            await interaction.editReply(
                'Something went wrong while registering. Check the bot logs.'
            );
        }
    },
};
