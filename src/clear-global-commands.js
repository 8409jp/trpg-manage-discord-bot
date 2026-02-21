const { REST, Routes } = require('discord.js');
require('dotenv').config();
const rest = new REST().setToken(process.env.DISCORD_TOKEN);
(async () => {
    try {
        console.log('グローバルコマンドの削除を開始します...');
        // 空の配列をPUTすることで、そのボットの全グローバルコマンドを削除します
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: [] },
        );
        console.log('グローバルコマンドをすべて削除しました。');
        console.log('※反映まで最大1時間かかる場合があります（Discordのクライアント再起動で即時反映されることが多いです）。');
    } catch (error) {
        console.error(error);
    }
})();
