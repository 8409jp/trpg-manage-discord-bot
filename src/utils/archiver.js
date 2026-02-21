const transcript = require('discord-html-transcripts');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const crypto = require('crypto');
const sharp = require('sharp');

async function downloadAsset(url, assetsDir, assetMap) {
    if (assetMap.has(url)) return assetMap.get(url);

    try {
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
        const contentType = response.headers['content-type'] || '';

        const isImage = contentType.startsWith('image/');
        const isText = contentType.startsWith('text/') || contentType.includes('application/json');
        const isAttachment = url.includes('/attachments/');

        // 画像、テキスト、またはUI要素（アバター・絵文字等）以外はダウンロードをスキップ
        if (!isImage && !isText && isAttachment) {
            return null;
        }

        const isCompressibleImage = isImage && !contentType.includes('gif');
        const hash = crypto.createHash('md5').update(url).digest('hex');
        let data = response.data;
        let extension = contentType ? contentType.split('/')[1].split(';')[0] : 'png';

        // 画像の圧縮と変換 (WebP形式へ)
        if (isCompressibleImage) {
            try {
                const image = sharp(data);
                const metadata = await image.metadata();

                let pipeline = image;
                if (metadata.width > 1200) {
                    pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
                }

                data = await pipeline
                    .webp({ quality: 75 })
                    .toBuffer();
                extension = 'webp';
            } catch (err) {
                console.error(`Compression failed for ${url}:`, err.message);
            }
        }

        const filename = `${hash}.${extension}`;
        const filePath = path.join(assetsDir, filename);

        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, data);
        }

        assetMap.set(url, filename);
        return filename;
    } catch (error) {
        console.error(`Failed to download asset: ${url}`, error.message);
        return null;
    }
}

async function localizeHtml(html, assetsDir, assetMap, depth) {
    const urlRegex = /https:\/\/(?:cdn|media)\.discordapp\.(?:com|net)\/[^\s"']+/g;
    let localizedHtml = html;
    const matches = html.match(urlRegex);

    if (matches) {
        const uniqueUrls = [...new Set(matches)];
        const prefix = '../'.repeat(depth) + 'assets/';

        for (const url of uniqueUrls) {
            const cleanUrl = url.split('"')[0].split('\'')[0].split(')')[0];
            const localFile = await downloadAsset(cleanUrl, assetsDir, assetMap);
            if (localFile) {
                localizedHtml = localizedHtml.split(cleanUrl).join(prefix + localFile);
            }
        }
    }
    return localizedHtml;
}

async function createFullArchive(category, sessionName, options = {}) {
    const { skipAssets = false } = options;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trpg-archive-'));
    const srcDir = path.join(tempDir, 'src');
    const assetsDir = path.join(tempDir, 'assets');
    fs.mkdirSync(srcDir);
    fs.mkdirSync(assetsDir);

    const assetMap = new Map();
    const archivePath = path.join(os.tmpdir(), `${sessionName}.zip`);
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    const channels = category.children.cache.filter(c => c.type === 0 || c.type === 15); // Text or Forum
    const sidebarItems = [];

    for (const [id, channel] of channels) {
        console.log(`Archiving channel: ${channel.name}...`);

        const channelFileName = `${channel.name}.html`;
        const channelHtmlRaw = await transcript.createTranscript(channel, {
            filename: channelFileName,
            saveImages: false,
            poweredBy: false,
        });

        const channelHtml = skipAssets
            ? channelHtmlRaw.attachment.toString()
            : await localizeHtml(channelHtmlRaw.attachment.toString(), assetsDir, assetMap, 1);
        fs.writeFileSync(path.join(srcDir, channelFileName), channelHtml);

        const channelItem = {
            name: channel.name,
            file: `src/${channelFileName}`,
            threads: []
        };

        try {
            const activeThreads = await channel.threads.fetchActive();
            const archivedThreads = await channel.threads.fetchArchived();
            const threads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

            if (threads.length > 0) {
                const threadDirName = channel.name;
                const threadDirPath = path.join(srcDir, threadDirName);
                if (!fs.existsSync(threadDirPath)) {
                    fs.mkdirSync(threadDirPath);
                }

                for (const thread of threads) {
                    console.log(`Archiving thread: ${thread.name} in ${channel.name}...`);
                    const threadFileName = `${thread.name}.html`;

                    const messages = await thread.messages.fetch({ limit: 100 });
                    const messageArray = [...messages.values()].reverse();

                    try {
                        const starterMessage = await thread.fetchStarterMessage().catch(() => null);
                        if (starterMessage && !messageArray.find(m => m.id === starterMessage.id)) {
                            messageArray.unshift(starterMessage);
                        }
                    } catch (e) {
                        console.log(`Starter message for thread ${thread.name} not found.`);
                    }

                    const threadHtmlRaw = await transcript.generateFromMessages(messageArray, thread, {
                        filename: threadFileName,
                        saveImages: false,
                        poweredBy: false,
                    });

                    const threadHtml = skipAssets
                        ? threadHtmlRaw.attachment.toString()
                        : await localizeHtml(threadHtmlRaw.attachment.toString(), assetsDir, assetMap, 2);
                    fs.writeFileSync(path.join(threadDirPath, threadFileName), threadHtml);

                    channelItem.threads.push({
                        name: thread.name,
                        file: `src/${threadDirName}/${threadFileName}`
                    });
                }
            }
        } catch (error) {
            console.error(`Error archiving threads for ${channel.name}:`, error);
        }

        sidebarItems.push(channelItem);
    }

    const sidebarHtml = sidebarItems.map(channel => `
<div class="channel-group">
    <a href="${channel.file}" target="content-frame" class="channel-link"># ${channel.name}</a>
    ${channel.threads.length > 0 ? `
    <div class="thread-list">
        ${channel.threads.map(thread => `
        <a href="${thread.file}" target="content-frame" class="channel-link thread-link"># ${thread.name}</a>
        `).join('')}
    </div>
    ` : ''}
</div>
    `).join('');

    const indexHtmlRaw = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>${sessionName} Archive Viewer</title>
    <style>
        body { margin: 0; display: flex; height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #313338; color: #dbdee1; }
        .sidebar { width: 260px; background: #2b2d31; border-right: 1px solid #1e1f22; display: flex; flex-direction: column; }
        .sidebar-header { padding: 12px 16px; border-bottom: 1px solid #1e1f22; box-shadow: 0 1px 0 rgba(0,0,0,0.1); }
        .sidebar-header h1 { font-size: 16px; margin: 0; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sidebar-content { flex: 1; overflow-y: auto; padding: 12px 8px; }
        .channel-group { margin-bottom: 8px; }
        .channel-link {
            display: flex; align-items: center; padding: 6px 8px; border-radius: 4px;
            color: #949ba4; text-decoration: none; font-size: 15px; margin-bottom: 2px;
            transition: background 0.1s, color 0.1s;
        }
        .channel-link:hover { background: #35373c; color: #dbdee1; }
        .channel-link.active { background: #404249; color: white; }
        .thread-list { margin-left: 16px; border-left: 1px solid #4e5058; padding-left: 8px; }
        .thread-link { font-size: 14px; padding: 4px 8px; }
        .content { flex: 1; position: relative; }
        iframe { width: 100%; height: 100%; border: none; background: #313338; }
    </style>
    <script>
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('channel-link')) {
                document.querySelectorAll('.channel-link').forEach(el => el.classList.remove('active'));
                e.target.classList.add('active');
            }
        });
    </script>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-header">
            <h1>${sessionName} Archive</h1>
        </div>
        <div class="sidebar-content">
            ${sidebarHtml}
        </div>
    </div>
    <div class="content">
        <iframe name="content-frame" src="${sidebarItems[0]?.file || ''}"></iframe>
    </div>
</body>
</html>
    `;
    const indexHtml = skipAssets
        ? indexHtmlRaw
        : await localizeHtml(indexHtmlRaw, assetsDir, assetMap, 0);
    fs.writeFileSync(path.join(tempDir, 'index.html'), indexHtml);

    archive.directory(tempDir, false);
    await archive.finalize();

    return new Promise((resolve, reject) => {
        output.on('close', () => {
            // 作業完了後に一時ディレクトリを削除
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (err) {
                console.error('Failed to cleanup temp storage:', err);
            }
            resolve(archivePath);
        });
        output.on('error', (err) => {
            // エラー時もクリーンアップを試行
            try {
                fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (cleanupErr) {
                console.error('Failed to cleanup temp storage after error:', cleanupErr);
            }
            reject(err);
        });
    });
}

module.exports = { createFullArchive };
