const { Events } = require('discord.js');
const { DynamicLoader } = require('bcdice');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // ボットのメッセージは無視
        if (message.author.bot) return;

        // メッセージを半角・全角空白で分割
        // 全角空白も考慮して正規表現で分割
        const args = message.content.split(/[\s\u3000]+/);
        const command = args[0];

        if (!command) return;

        try {
            const loader = new DynamicLoader();
            // とりあえずデフォルトの DiceBot を使用
            // 本来はシステムごとに切り替える機能が望ましいが、要件に従い「最初の要素を渡す」
            const GameSystem = await loader.dynamicLoad('DiceBot');

            const result = GameSystem.eval(command);

            if (result && result.text) {
                await message.reply(result.text);
            }
        } catch (error) {
            console.error('BCDice evaluation error:', error);
            // エラー時は特に何もしない（ダイスコマンドでない可能性が高いため）
        }
    },
};
