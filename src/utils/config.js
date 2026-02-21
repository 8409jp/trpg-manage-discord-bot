const fs = require('fs');
const path = require('path');

const configDir = path.join(__dirname, '../../data');
const configPath = path.join(configDir, 'config.json');

/**
 * 設定ファイルを読み込みます。
 */
function loadConfigs() {
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
        return {};
    }
    try {
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Failed to load config.json:', error);
        return {};
    }
}

/**
 * 設定ファイルを保存します。
 */
function saveConfigs(configs) {
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
}

/**
 * 特定のギルドの設定を取得します。
 */
async function getGuildConfig(client, guildId) {
    const configs = loadConfigs();
    return configs[guildId];
}

/**
 * 特定のギルドの設定を保存します。
 */
async function setGuildConfig(client, guildId, categoryId) {
    const configs = loadConfigs();
    configs[guildId] = categoryId;
    saveConfigs(configs);
}

module.exports = { getGuildConfig, setGuildConfig };
