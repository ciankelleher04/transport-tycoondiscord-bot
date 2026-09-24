const logger = require("./logger");

const WARNING_LEVELS = [100, 50, 25, 10, 1];

async function checkApiChargeReminder(
    client,
    discordId,
    user,
    chargesLeft
) {
    const remainingCharges = Number(chargesLeft);

    if (!Number.isFinite(remainingCharges)) {
        return;
    }

    if (!Array.isArray(user.apiChargeWarningsSent)) {
        user.apiChargeWarningsSent = [];
    }

    // Allow warnings to be sent again after the user adds more charges.
    user.apiChargeWarningsSent = user.apiChargeWarningsSent.filter(
        warningLevel => remainingCharges <= warningLevel
    );

    const warningLevel = [...WARNING_LEVELS]
        .reverse()
        .find(level =>
            remainingCharges <= level &&
            !user.apiChargeWarningsSent.includes(level)
        );

    if (!warningLevel) {
        return;
    }

    try {
        const discordUser = await client.users.fetch(discordId);

        const chargeText =
            remainingCharges === 1
                ? "1 API charge"
                : `${remainingCharges} API charges`;

        await discordUser.send(
            `⚠️ **TT Tools API Charge Warning**\n\n` +
            `You only have **${chargeText} remaining**.\n\n` +
            `TT Tools may be unable to refresh your streak information once your charges run out.`
        );

        // Mark this level and any less urgent levels as already handled.
        for (const level of WARNING_LEVELS) {
            if (
                level >= warningLevel &&
                !user.apiChargeWarningsSent.includes(level)
            ) {
                user.apiChargeWarningsSent.push(level);
            }
        }

        logger.info(
            `[API CHARGES] Warned ${discordId}: ${remainingCharges} charges remaining.`
        );
    } catch (error) {
        logger.error(
            `[API CHARGES] Could not warn ${discordId}:`,
            error
        );
    }
}

module.exports = {
    checkApiChargeReminder,
};
