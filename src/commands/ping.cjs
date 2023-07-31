'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');

const slashCommandData = new SlashCommandBuilder()
    .setName('ping')
    .setDescription("Check connectivity.")
    .setDescriptionLocalizations({
        'es-ES': "Probar la conectividad.",
        'pl': "Sprawdź łączność.",
    })
    ;

const slashCommandExecutor = async function (_bot, interaction) {
    await interaction.reply("Pong!");
};

module.exports = {
    slashCommand: {
        data: slashCommandData,
        execute: slashCommandExecutor,
    },
};