const { Events, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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
