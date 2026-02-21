const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createFullArchive } = require('../utils/archiver');
const { getGuildConfig } = require('../utils/config');
const fs = require('fs');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('session-archive')
        .setDescription('セッションを終了し、ログのアーカイブを作成してチャンネルを整理します。')
        .addStringOption(option =>
            option.setName('category_id')
                .setDescription('アーカイブするカテゴリのIDを入力してください')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('delete_roles')
                .setDescription('GM/観戦ロールを削除しますか？ (デフォルト: false)'))
        .addBooleanOption(option =>
            option.setName('delete_channels')
                .setDescription('完了後にカテゴリとチャンネルを削除しますか？ (デフォルト: false)'))
        .addStringOption(option =>
            option.setName('target_channel_id')
                .setDescription('既存のチャンネルに送信したい場合は、チャンネルIDを入力してください'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const categoryId = interaction.options.getString('category_id');
        const deleteRoles = interaction.options.getBoolean('delete_roles') ?? false;
        const deleteChannels = interaction.options.getBoolean('delete_channels') ?? false;
        const targetChannelId = interaction.options.getString('target_channel_id');
        const guild = interaction.guild;
        const category = guild.channels.cache.get(categoryId);

        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: '無効なカテゴリIDです。', flags: [MessageFlags.Ephemeral] });
        }

        const sessionName = category.name;
        await interaction.reply({ content: `${sessionName} のアーカイブ処理を開始します。この処理には時間がかかる場合があります...`, flags: [MessageFlags.Ephemeral] });

        try {
            // カテゴリの権限設定からロールを特定 (参加者リスト作成やクリーンアップに使用)
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

            // ロールからメンバーを取得し、リストと権限設定を作成
            const overwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                }
            ];
            const memberLists = {
                pl: [],
                observer: [],
                gm: []
            };
            const MAX_OVERWRITES = 250;
            const addedUserIds = new Set();
            const addOverwrite = (id, list, name) => {
                if (!addedUserIds.has(id)) {
                    if (overwrites.length < MAX_OVERWRITES) {
                        overwrites.push({ id: id, allow: [PermissionFlagsBits.ViewChannel] });
                        addedUserIds.add(id);
                    }
                }
                if (!list.some(item => item.includes(id))) {
                    list.push(name);
                }
            };

            if (plRole) {
                const members = await plRole.members;
                for (const [id, member] of members) {
                    addOverwrite(member.id, memberLists.pl, member.toString());
                }
            }
            if (gmRole) {
                const members = await gmRole.members;
                for (const [id, member] of members) {
                    addOverwrite(member.id, memberLists.gm, member.toString());
                }
            }
            if (observerRole) {
                const members = await observerRole.members;
                for (const [id, member] of members) {
                    addOverwrite(member.id, memberLists.observer, member.toString());
                }
            }

            let archiveChannel;
            if (targetChannelId) {
                archiveChannel = guild.channels.cache.get(targetChannelId);
                if (!archiveChannel || !archiveChannel.isTextBased()) {
                    return interaction.editReply('❌ 指定された送信先チャンネルIDが無効、またはテキストチャンネルではありません。');
                }
            } else {
                let archiveCategoryId = await getGuildConfig(interaction.client, guild.id);

                let archiveCategory = null;
                if (archiveCategoryId) {
                    archiveCategory = guild.channels.cache.get(archiveCategoryId);
                }

                if (!archiveCategory) {
                    archiveCategory = guild.channels.cache.find(c => c.name.toLowerCase() === 'archive' && c.type === ChannelType.GuildCategory);
                }

                if (!archiveCategory) {
                    return interaction.editReply('❌ アーカイブ先のカテゴリが見つかりませんでした。`/setup-archive` で設定するか、`archive` という名前のカテゴリを作成してください。');
                }

                archiveChannel = await guild.channels.create({
                    name: sessionName,
                    type: ChannelType.GuildText,
                    parent: archiveCategory.id,
                    permissionOverwrites: overwrites,
                });

                if (overwrites.length >= MAX_OVERWRITES) {
                    await archiveChannel.send('⚠️ 参加者が非常に多いため、一部のユーザーへの個別権限付与を制限しました。必要に応じて手動で調整してください。');
                }
            }

            // 参加者リストメッセージの構築 (2000文字制限対応)
            let participationText = `📁 **${sessionName}** のセッションアーカイブが作成されました。\n\n`;

            const buildList = (title, items) => {
                if (items.length === 0) return '';
                let text = `**${title}:** ${items.join(', ')}\n`;
                if (participationText.length + text.length > 1900) {
                    return `**${title}:** 他 ${items.length} 名 (文字数制限により省略)\n`;
                }
                return text;
            };

            participationText += buildList('PL', memberLists.pl);
            participationText += buildList('観戦', memberLists.observer);
            participationText += buildList('SGM', memberLists.gm);

            let zipPath = null;
            try {
                zipPath = await createFullArchive(category, sessionName);
                let stats = fs.statSync(zipPath);
                let fileSizeInMB = stats.size / (1024 * 1024);

                // 25MB制限のガード (24.5MBで余裕を持たせる)
                if (fileSizeInMB > 24.5) {
                    console.log(`Archive too large (${fileSizeInMB.toFixed(2)}MB). Retrying with Lite Mode...`);
                    fs.unlinkSync(zipPath);
                    zipPath = await createFullArchive(category, sessionName, { skipAssets: true });
                    stats = fs.statSync(zipPath);
                    fileSizeInMB = stats.size / (1024 * 1024);
                }

                // 送信試行
                try {
                    const attachment = new AttachmentBuilder(zipPath, { name: `${sessionName}_archive.zip` });
                    await archiveChannel.send({
                        content: participationText + (fileSizeInMB > 24.5 ? '\n⚠️ ファイルサイズ制限のため、アセットを含まない「ライトモード」で作成されました。' : ''),
                        files: [attachment]
                    });
                } catch (sendError) {
                    if (sendError.status === 413) {
                        console.log('413 Error detected during upload. Attempting Lite Mode fallback...');
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        zipPath = await createFullArchive(category, sessionName, { skipAssets: true });
                        const attachment = new AttachmentBuilder(zipPath, { name: `${sessionName}_archive_lite.zip` });
                        await archiveChannel.send({
                            content: participationText + '\n⚠️ 送信サイズ制限により、アセットを含まない「ライトモード」で再生成されました。',
                            files: [attachment]
                        });
                    } else {
                        throw sendError;
                    }
                }

                // 3. ロールの削除 (刷新: 移行処理をなくし、基本全て削除)
                if (deleteRoles !== false) {
                    if (plRole) await plRole.delete('Archive cleanup').catch(() => { });
                    if (gmRole) await gmRole.delete('Archive cleanup').catch(() => { });
                    if (observerRole) await observerRole.delete('Archive cleanup').catch(() => { });
                }

                // 4. カテゴリとチャンネルの削除 (オプション)
                if (deleteChannels) {
                    for (const [id, channel] of category.children.cache) {
                        await channel.delete('Archive cleanup').catch(() => { });
                    }
                    await category.delete('Archive cleanup').catch(() => { });
                }

                try {
                    await interaction.editReply(`✅ ${sessionName} のアーカイブが完了しました！\nログは ${archiveChannel} に保存されました。${deleteRoles !== false ? '\n関連ロールは削除されました。' : ''}`);
                    console.log(`[Success] ${sessionName} のアーカイブが完了しました。`);
                } catch (e) {
                    console.log(`[Info] ${sessionName} のアーカイブは完了しました。`);
                }
            } finally {
                // 絶対に一時ファイルを削除
                if (zipPath && fs.existsSync(zipPath)) {
                    fs.unlinkSync(zipPath);
                }
            }
        } catch (error) {
            console.error(error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply('❌ アーカイブ処理中にエラーが発生しました。ログを確認してください。');
                }
            } catch (e) {
                // 返信先が消えている場合は無視
            }
        }
    },
};
