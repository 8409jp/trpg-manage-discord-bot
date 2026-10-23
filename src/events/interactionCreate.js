const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // ── ボタンインタラクション ──────────────────────────────────────
        if (interaction.isButton()) {
            const parts = interaction.customId.split(':');
            const prefix = parts[0];

            if (prefix === 'role-self') {
                let action = 'toggle';
                let roleId;

                if (parts.length === 3) {
                    // 新形式: role-self:add:ROLE_ID または role-self:remove:ROLE_ID
                    action = parts[1];
                    roleId = parts[2];
                } else {
                    // 旧形式: role-self:ROLE_ID (後方互換用)
                    roleId = parts[1];
                }

                try {
                    const role = interaction.guild.roles.cache.get(roleId);

                    if (!role) {
                        return interaction.reply({
                            content: '❌ 対象のロールが見つかりません。ロールが削除された可能性があります。',
                            flags: [MessageFlags.Ephemeral],
                        });
                    }

                    const member = interaction.member;
                    const hasRole = member.roles.cache.has(roleId);

                    if (action === 'add') {
                        if (hasRole) {
                            return interaction.reply({
                                content: `ℹ️ 既に **${role.name}** ロールを持っています。`,
                                flags: [MessageFlags.Ephemeral],
                            });
                        }
                        await member.roles.add(role);
                        await interaction.reply({
                            content: `🟢 **${role.name}** ロールが付与されました。`,
                            flags: [MessageFlags.Ephemeral],
                        });
                    } else if (action === 'remove') {
                        if (!hasRole) {
                            return interaction.reply({
                                content: `ℹ️ **${role.name}** ロールを持っていません。`,
                                flags: [MessageFlags.Ephemeral],
                            });
                        }
                        await member.roles.remove(role);
                        await interaction.reply({
                            content: `🔴 **${role.name}** ロールが解除されました。`,
                            flags: [MessageFlags.Ephemeral],
                        });
                    } else {
                        // 旧形式（トグル）
                        if (hasRole) {
                            await member.roles.remove(role);
                            await interaction.reply({
                                content: `🔴 **${role.name}** ロールが解除されました。`,
                                flags: [MessageFlags.Ephemeral],
                            });
                        } else {
                            await member.roles.add(role);
                            await interaction.reply({
                                content: `🟢 **${role.name}** ロールが付与されました。`,
                                flags: [MessageFlags.Ephemeral],
                            });
                        }
                    }
                } catch (error) {
                    console.error('[role-self] ロール操作エラー:', error);
                    await interaction.reply({
                        content: '❌ ロールの操作に失敗しました。Botに「ロールの管理」権限があるか確認してください。',
                        flags: [MessageFlags.Ephemeral],
                    });
                }
            }

            return; // ボタン処理はここで終了
        }

        // ── オートコンプリート ─────────────────────────────────────────
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(`[Autocomplete Error] ${interaction.commandName}:`, error);
            }
            return;
        }

        // ── スラッシュコマンド ─────────────────────────────────────────
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`${interaction.commandName} というコマンドは見つかりませんでした。`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);

            // チャンネルやメッセージが既に削除されている場合は無視
            if (error.code === 10008 || error.code === 10003) return;

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'コマンドの実行中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
                } else {
                    await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] });
                }
            } catch (innerError) {
                // 報告自体が失敗した場合はログにのみ出す
                console.error('Error reporting interaction failure:', innerError);
            }
        }
    },
};
