'use strict';

const { GatewayIntentBits } = require('discord-api-types/v10');
const { IntentsBitField } = require('discord.js');

const { Bot } = require('./bot.cjs');

require('dotenv').config();

const bot = new Bot({
    clientOptions: {
        intents: new IntentsBitField([
            GatewayIntentBits.Guilds,
        ]),
    },
});

bot.start(process.env.DISCORD_TOKEN);