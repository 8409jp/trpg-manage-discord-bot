const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { setGuildConfig } = require('../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-archive')
        .setDescription('このサーバーのセッションアーカイブ先カテゴリを設定します。')
        .addStringOption(option =>
            option.setName('category_id')
                .setDescription('アーカイブ先のカテゴリIDを入力してください')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const categoryId = interaction.options.getString('category_id');
        const guild = interaction.guild;
        const client = interaction.client;

        // カテゴリの存在確認
        const category = guild.channels.cache.get(categoryId);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: '❌ 無効なカテゴリIDです。カテゴリIDを正しく入力してください。', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            await setGuildConfig(client, guild.id, categoryId);
            await interaction.editReply(`✅ このサーバーのアーカイブ先を **${category.name}** (${categoryId}) に設定しました。情報はローカル設定に保存されました。`);
        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ 設定の保存中にエラーが発生しました。ボットの書き込み権限などを確認してください。\nエラー: ${error.message}`);
        }
    },
};
