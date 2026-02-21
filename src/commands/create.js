const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('session-create')
        .setDescription('新しいTRPGセッション用の環境を作成します。')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('セッションの名前を入力してください')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('use_gm')
                .setDescription('GM用ロールと専用チャンネルを作成しますか？'))
        .addBooleanOption(option =>
            option.setName('use_observer')
                .setDescription('観戦用ロールと専用チャンネルを作成しますか？'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const sessionName = interaction.options.getString('name');
        const useGM = interaction.options.getBoolean('use_gm') ?? false; // デフォルトをfalseに変更
        const useObserver = interaction.options.getBoolean('use_observer') ?? false; // デフォルトをfalseに変更
        const guild = interaction.guild;

        await interaction.reply({ content: `${sessionName} の作成を開始します...`, flags: [MessageFlags.Ephemeral] });

        try {
            // 1. ロールの作成
            const plRole = await guild.roles.create({ name: sessionName, reason: 'TRPG Session Create' });
            let gmRole = null;
            let observerRole = null;

            if (useGM) {
                gmRole = await guild.roles.create({ name: `${sessionName}-GM`, reason: 'TRPG Session Create' });
            }
            if (useObserver) {
                observerRole = await guild.roles.create({ name: `${sessionName}-観戦`, reason: 'TRPG Session Create' });
            }

            // 2. カテゴリの作成
            const categoryOverwrites = [
                {
                    id: guild.id, // @everyone
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: plRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                },
            ];
            if (gmRole) {
                categoryOverwrites.push({
                    id: gmRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                });
            }
            if (observerRole) {
                categoryOverwrites.push({
                    id: observerRole.id,
                    allow: [PermissionFlagsBits.ViewChannel],
                });
            }

            const category = await guild.channels.create({
                name: sessionName,
                type: ChannelType.GuildCategory,
                permissionOverwrites: categoryOverwrites,
            });

            // 3. チャンネルの作成
            // 基本チャンネル
            const baseChannels = ['連絡', '雑談', 'CS提出所'];
            for (const name of baseChannels) {
                const overwrites = [
                    {
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: plRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    }
                ];
                if (gmRole) {
                    overwrites.push({
                        id: gmRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    });
                }
                if (observerRole) {
                    overwrites.push({
                        id: observerRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    });
                }

                // CS提出所の制限 (観戦は書き込み不可)
                if (name === 'CS提出所' && observerRole) {
                    const obsOverwrite = overwrites.find(o => o.id === observerRole.id);
                    obsOverwrite.deny = [PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads];
                    obsOverwrite.allow = [PermissionFlagsBits.ViewChannel];
                }

                await guild.channels.create({
                    name: name,
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: overwrites,
                });
            }

            // 観戦チャンネル (観戦&GMのみ書き込み)
            if (useObserver || useGM) {
                const observerOverwrites = [
                    {
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: plRole.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    }
                ];
                if (observerRole) {
                    observerOverwrites.push({
                        id: observerRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads],
                    });
                }
                if (gmRole) {
                    observerOverwrites.push({
                        id: gmRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.SendMessagesInThreads],
                    });
                }

                await guild.channels.create({
                    name: '観戦',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: observerOverwrites,
                });
            }

            // GM連絡用 (GMのみ閲覧&書き込み)
            if (useGM && gmRole) {
                await guild.channels.create({
                    name: 'GM連絡用',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.id, // @everyone
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: plRole.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        observerRole ? {
                            id: observerRole.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        } : null,
                        {
                            id: gmRole.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                    ].filter(Boolean),
                });
            }

            let responseMessage = `✅ ${sessionName} の環境作成が完了しました！\n作成されたロール: ${plRole}`;
            if (gmRole) responseMessage += `, ${gmRole}`;
            if (observerRole) responseMessage += `, ${observerRole}`;

            await interaction.editReply(responseMessage);
            console.log(`[Success] ${sessionName} の作成が完了しました。`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ 作成中にエラーが発生しました。ボットに「チャンネルの管理」や「ロールの管理」権限があるか確認してください。');
        }
    },
};
