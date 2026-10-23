const { ChannelType } = require('discord.js');
const { getGuildConfig } = require('./config');

/**
 * カテゴリのオートコンプリート候補を生成して返します。
 * @param {import('discord.js').AutocompleteInteraction} interaction
 */
async function handleCategoryAutocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const guild = interaction.guild;
    if (!guild) return interaction.respond([]);

    // 保存先アーカイブ用カテゴリID（誤操作防止のため除外）
    const archiveCategoryId = await getGuildConfig(interaction.client, guild.id);

    const categories = guild.channels.cache.filter(c => {
        if (c.type !== ChannelType.GuildCategory) return false;
        if (archiveCategoryId && c.id === archiveCategoryId) return false;
        if (c.name.toLowerCase() === 'archive') return false;
        return true;
    });

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(focusedValue) || c.id.includes(focusedValue)
    );

    // Discordの制限により最大25件まで返却
    const results = Array.from(filtered.values()).slice(0, 25).map(c => ({
        name: c.name.length > 100 ? c.name.slice(0, 97) + '...' : c.name,
        value: c.id,
    }));

    await interaction.respond(results);
}

/**
 * 入力された値（IDまたはカテゴリ名）からカテゴリチャンネルを解決します。
 * @param {import('discord.js').Guild} guild
 * @param {string} input
 * @returns {import('discord.js').CategoryChannel | null}
 */
function resolveCategory(guild, input) {
    if (!guild || !input) return null;

    // 1. IDでの直接取得
    let category = guild.channels.cache.get(input);
    if (category && category.type === ChannelType.GuildCategory) return category;

    // 2. 完全一致での名前検索
    category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === input);
    if (category) return category;

    // 3. 大文字小文字を無視した名前検索
    category = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === input.toLowerCase());
    if (category) return category;

    return null;
}

module.exports = {
    handleCategoryAutocomplete,
    resolveCategory,
};
