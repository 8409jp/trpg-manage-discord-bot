const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { handleCategoryAutocomplete, resolveCategory } = require('../utils/categoryAutocomplete');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('session-delete')
        .setDescription('アーカイブせずにセッション環境（カテゴリ・チャンネル・ロール）を直接削除します。')
        .addStringOption(option =>
            option.setName('category')
                .setDescription('削除するカテゴリを選択または入力してください')
                .setRequired(true)
                .setAutocomplete(true))
        .addBooleanOption(option =>
            option.setName('confirm')
                .setDescription('本当に削除する場合は「True」を選択してください')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async autocomplete(interaction) {
        await handleCategoryAutocomplete(interaction);
    },
    async execute(interaction) {
        const categoryInput = interaction.options.getString('category');
        const confirm = interaction.options.getBoolean('confirm');
        const guild = interaction.guild;

        if (!confirm) {
            return interaction.reply({ content: '削除をキャンセルしました。確認オプションを「True」にして実行してください。', flags: [MessageFlags.Ephemeral] });
        }

        const category = resolveCategory(guild, categoryInput);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: '指定されたカテゴリが見つかりません。入力候補から選択するか、正しいカテゴリ名またはIDを指定してください。', flags: [MessageFlags.Ephemeral] });
        }

        const sessionName = category.name;
        await interaction.reply({ content: `${sessionName} の削除処理を開始します...`, flags: [MessageFlags.Ephemeral] });

        try {
            // サーバーのチャンネルおよびロールキャッシュが空の場合に備えて事前にフェッチ
            await Promise.all([
                guild.channels.fetch().catch(console.error),
                guild.roles.fetch().catch(console.error),
            ]);

            // 1. カテゴリの権限設定からロールを特定
            let plRole = null;
            let gmRole = null;
            let observerRole = null;

            for (const overwrite of category.permissionOverwrites.cache.values()) {
                if (overwrite.type !== 0) continue; // ロール以外はスキップ
                const role = guild.roles.cache.get(overwrite.id);
                if (!role) continue;

                if (role.name === sessionName) plRole = role;
                else if (role.name === `${sessionName}-GM`) gmRole = role;
                else if (role.name === `${sessionName}-観戦`) observerRole = role;
            }

            if (plRole) await plRole.delete('Session Direct Delete').catch(e => console.error('PLロール削除失敗:', e));
            if (gmRole) await gmRole.delete('Session Direct Delete').catch(e => console.error('GMロール削除失敗:', e));
            if (observerRole) await observerRole.delete('Session Direct Delete').catch(e => console.error('観戦ロール削除失敗:', e));

            // 2. カテゴリ内の全チャンネルを削除
            const channels = category.children.cache;
            for (const [id, channel] of channels) {
                await channel.delete('Session Direct Delete').catch(e => console.error(`${channel.name} 削除失敗:`, e));
            }

            // 3. カテゴリ自体の削除
            await category.delete('Session Direct Delete');

            // 実行元のチャンネルが削除された可能性があるため、try-catchで囲む
            try {
                await interaction.editReply(`✅ ${sessionName} のすべての環境（カテゴリ・チャンネル・ロール）を削除しました。`);
                console.log(`[Success] ${sessionName} の削除が完了しました。`);
            } catch (e) {
                console.log(`[Info] ${sessionName} の削除は完了しましたが、実行元チャンネルが削除されたため返信はスキップされました。`);
            }
        } catch (error) {
            console.error(error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply('❌ 削除中にエラーが発生しました。ボットの権限やロールの順序を確認してください。');
                }
            } catch (e) {
                // 返信先が消えている場合は無視
            }
        }
    },
};
