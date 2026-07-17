const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // ── ボタンインタラクション ──────────────────────────────────────
        if (interaction.isButton()) {
            const [prefix, roleId] = interaction.customId.split(':');

            if (prefix === 'role-self') {
                try {
                    const role = interaction.guild.roles.cache.get(roleId);

                    if (!role) {
                        return interaction.reply({
                            content: '❌ 対象のロールが見つかりません。ロールが削除された可能性があります。',
                            flags: [MessageFlags.Ephemeral],
                        });
                    }

                    const member = interaction.member;

                    if (member.roles.cache.has(roleId)) {
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
