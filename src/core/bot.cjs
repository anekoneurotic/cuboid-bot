'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { ActivityType, ApplicationCommandType } = require('discord-api-types/v10');
const { Client, Collection, Events } = require('discord.js');
const pino = require('pino');

class Bot {
    client;
    devGuildId;
    slashCommands;

    #debugMode;
    #devGuildId;
    #djsLogger;
    #logger;

    constructor({
        botOptions: {
            debugMode = undefined,
            devGuildId = undefined,
        } = {},
        clientOptions = {},
    }) {
        this.#debugMode = (typeof debugMode === 'boolean')
            ? debugMode
            : process.env.NODE_ENV !== 'production'
        ;

        this.#devGuildId = (typeof devGuildId === 'string')
            ? devGuildId
            : process.env.CUBOID_DEV_GUILD
        ;

        const level = (this.#debugMode) ? 'debug' : 'info';
        this.#logger = pino({
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
        this.#djsLogger = this.#logger.child({ cuboidContext: 'discord.js' });

        this.slashCommands = new Collection();

        const commandsPath = path.join(__dirname, '../commands');
        const commandNames = fs.readdirSync(commandsPath).filter(
            (file) =>
                file.endsWith('.js') || file.endsWith('.cjs')
            ,
        );

        for (const commandName of commandNames) {
            const commandPath = path.join(commandsPath, commandName);
            const command = require(commandPath);

            const slashCommand = command.slashCommand;

            if (slashCommand) {
                if (
                    'data' in slashCommand
                    && 'execute' in slashCommand
                ) {
                    this.slashCommands.set(
                        slashCommand.data.name,
                        slashCommand,
                    );
                } else {
                    this.#logger.warn(
                        "Ignoring invalid slashCommand object in "
                        + commandPath
                        ,
                    );
                }
            }
        }

        this.client = new Client(clientOptions);

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const slashCommand = this.slashCommands.get(
                interaction.commandName,
            );

            if (!slashCommand) {
                this.#logger.error(
                    "Received interaction for unrecognized command "
                    + interaction.commandName
                    ,
                );
                return;
            }

            try {
                await slashCommand.execute(this, interaction);
            } catch (error) {
                this.#logger.error(error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content:
                            "There was an error while executing this command!"
                        ,
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content:
                            "There was an error while executing this command!"
                        ,
                        ephemeral: true,
                    });
                }
            }
        });

        this.client.once(Events.ClientReady, async (client) => {
            this.#logger.info(`Ready! Logged in as: ${client.user.tag}`);

            const devGuild = this.devGuild;
            if (devGuild) {
                this.#logger.info(`Development guild: ${devGuild.name} (${devGuild.id})`);
            }

            const commandScope = (this.#debugMode)
                ? devGuild
                : client.application
            ;

            if (commandScope) {
                const commandManager = commandScope.commands;

                let ranSynchronization = false;

                (await commandManager.fetch({ withLocalizations: true })).forEach(
                    (command) => {
                        const commandDescription = (command.guild)
                            ? `${command.guild.name} guild command ${command.name} (type ${command.type})`
                            : `global command ${command.name} (type ${command.type})`
                        ;

                        this.#logger.debug(
                            `Checking ${commandDescription}`,
                        );

                        if (command.type === ApplicationCommandType.ChatInput) {
                            const slashCommand = this.slashCommands.get(command.name);

                            if (!slashCommand) {
                                this.#logger.warn(`Registration for unhandled ${commandDescription}`);
                                return;
                            }

                            const localCommand = JSON.parse(JSON.stringify(slashCommand.data.toJSON()));

                            if (command.equals(localCommand)) return;

                            this.#logger.info(`Synchronizing registration for ${commandDescription}`);
                            this.#logger.debug(`Local command definition: ${JSON.stringify(localCommand)}`);
                            this.#logger.debug(`Remote command definition: ${JSON.stringify(command)}`);

                            // NB: Not awaited since I don't want this handler async
                            command.edit(slashCommand.data.toJSON());

                            ranSynchronization = true;
                        }
                    },
                );

                if (ranSynchronization) {
                    this.#logger.warn(
                        "Synchronized one or more commands!"
                        + " Verify that this was not done in error!"
                        ,
                    );
                }
            } else {
                this.#logger.error(
                    "No valid command scope found!"
                    + " Skipping command reconciliation."
                    ,
                );
            }

            client.user.setPresence({
                activities: [
                    { type: ActivityType.Playing, name: "with Dark Magicks" },
                ],
            });
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

    get devGuild() {
        return (this.client.isReady())
            ? this.client.guilds.resolve(this.#devGuildId)
            : null
        ;
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