'use strict';

const { ActivityType } = require('discord-api-types/v10');
const { Client, Events } = require('discord.js');
const pino = require('pino');

class Bot {
    client;
    logger;

    #debugMode;
    #djsLogger;

    constructor({
        clientOptions = {},
        debug = undefined,
    }) {
        this.#debugMode = (typeof debug === 'boolean')
            ? debug
            : process.env.NODE_ENV !== 'production'
        ;

        const level = (this.#debugMode) ? 'debug' : 'info';
        this.logger = pino({
            level,
            transport: {
                targets: [
                    {
                        target: 'pino-pretty',
                        level,
                        options: {
                            colorize: true,
                            ignore: 'pid,hostname,cuboidContext',
                            messageFormat:
                                '({cuboidContext}): {msg}'
                            ,
                        },
                    },
                ],
            },
        }).child({ cuboidContext: 'bot' });
        this.#djsLogger = this.logger.child({ cuboidContext: 'discord.js' });

        this.client = new Client(clientOptions);

        this.client.once(Events.ClientReady, (client) => {
            this.logger.info(`Ready! Logged in as ${client.user.tag}`);
            client.user.setPresence({
                activities: [
                    { type: ActivityType.Playing, name: "with Dark Magicks" },
                ],
            });
            this.logger.error(new Error('test error'));
        });

        this.client.on(Events.Error, (error) => {
            this.#djsLogger.error(error);
        });

        this.client.on(Events.Warn, (info) => {
            this.#djsLogger.warn(info);
        });

        this.client.on(Events.Debug, (info) => {
            this.#djsLogger.debug(info);
        });

    }

    start({
        token = undefined,
    }) {
        return this.client.login(token);
    }

    stop() {
        return this.client.destroy();
    }
}

module.exports = {
    Bot,
};