require("dotenv").config();

const { REST, Routes } = require("discord.js");

const fs = require("node:fs");
const path = require("node:path");

const commands = [];

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    if (file === "dog.js") continue;

    try {
        console.log(`Loading command file: ${file}`);

        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if (!command.data) {
            console.warn(`⚠️ ${file} has no command.data. Skipping.`);
            continue;
        }

        commands.push(command.data.toJSON());
        console.log(`✅ Loaded ${file}`);
    } catch (error) {
        console.error(`❌ Failed to load ${file}`);
        console.error(error);
    }
}

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function deployCommands() {
    try {
        console.log("Registering slash commands...");

        await rest.put(
            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),
            { body: commands }
        );

        console.log("Slash commands registered!");
    } catch (error) {
        console.error(error);
    }
}

deployCommands();