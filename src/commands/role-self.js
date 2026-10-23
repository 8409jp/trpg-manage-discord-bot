const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role-self')
        .setDescription('ロールの付与/解除ボタンをチャンネルに設置します。')
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('付与/解除の対象とするロール')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('label')
                .setDescription('ボタンに表示するラベル（省略するとロール名が使われます）')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const role = interaction.options.getRole('role');
        const label = interaction.options.getString('label') ?? role.name;

        // @everyone や管理者ロールへの付与は危険なので弾く
        if (role.id === interaction.guild.id) {
            return interaction.reply({
                content: '❌ @everyone ロールは対象に指定できません。',
                flags: [MessageFlags.Ephemeral],
            });
        }
        if (role.managed) {
            return interaction.reply({
                content: '❌ Bot等が管理するロール（連携ロール）は対象に指定できません。',
                flags: [MessageFlags.Ephemeral],
            });
        }

        // customId にアクション（add/remove）とロールIDを埋め込む（Bot再起動後も機能する）
        const addButton = new ButtonBuilder()
            .setCustomId(`role-self:add:${role.id}`)
            .setLabel('取得')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕');

        const removeButton = new ButtonBuilder()
            .setCustomId(`role-self:remove:${role.id}`)
            .setLabel('解除')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('➖');

        const row = new ActionRowBuilder().addComponents(addButton, removeButton);

        await interaction.reply({
            content: `✅ ボタンを設置しました。（対象ロール: ${role}）`,
            flags: [MessageFlags.Ephemeral],
        });

        await interaction.channel.send({
            content: `🎭 **${label}** ロールの取得・解除ができます。`,
            components: [row],
        });
    },
};
