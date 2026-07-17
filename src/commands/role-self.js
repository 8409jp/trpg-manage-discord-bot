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

        // customId にロールIDを埋め込む（Bot再起動後も機能する）
        const button = new ButtonBuilder()
            .setCustomId(`role-self:${role.id}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎭');

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
            content: `✅ ボタンを設置しました。（対象ロール: ${role}）`,
            flags: [MessageFlags.Ephemeral],
        });

        await interaction.channel.send({
            content: `🎭 **${label}** ロールを取得・返却できます。`,
            components: [row],
        });
    },
};
