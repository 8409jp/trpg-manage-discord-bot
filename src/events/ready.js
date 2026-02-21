const { Events } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`準備完了！ ${client.user.tag} としてログインしました。`);
    },
};
