require('./settings');
const { exec } = require('child_process');
const systeminformation = require('systeminformation');
const os = require('os');
const chalk = require('chalk');
const fs = require('fs');
const moment = require('moment-timezone');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const sharp = require('sharp');
const path = require('path');
const { Sticker } = require('wa-sticker-formatter');
const yts = require("yt-search");
const axios = require("axios");
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { createWriteStream } = require('fs');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const { execSync } = require('child_process');
const handleAIPrivate = require('./handlers/aiPrivateHandler');
const { handleAlya, sendResponse, isTaggingBot } = require('./handlers/aiAlya');
const handleAI = require('./handlers/aiClaude');
const { handleSimiSettings, handleSimiChat } = require('./handlers/aiSimi');
const { handleBlackboxChat } = require('./handlers/aiBlackbox');
const { handleCharAI, handleCharList, chatbot } = require('./handlers/aiCharAi');
const handleDownload = require('./handlers/dlAll');
const { handleTtsave } = require('./handlers/dlTtsave');
const { handleIgram } = require('./handlers/dlIgram');
const { handlePinterest } = require('./handlers/dlPinterest');
const { handlePinApi, handleNext, handleStop } = require('./handlers/dlPinApi');
const { handleFacebook } = require('./handlers/dlFesnuk');
const { handleTest } = require('./handlers/toolsEval');

moment.locale('id');

module.exports.handleIncomingMessage = async (nvdia, msg) => {
    try {
       const timezone = 'Asia/Jakarta';
       const jam = moment().tz(timezone).format('dddd DD-MM-YYYY HH:mm:ss');
       const contactName = msg.pushName || 'Unknown';
       const sender = msg.key.remoteJid;
       const isGroup = sender.endsWith('@g.us');
        
        // Ekstrak message type dan content
        const messageType = Object.keys(msg.message || {})[0];
        let messageContent = '';
        
        // Cek apakah pesan me-reply bot
        const isReplyToBot = msg.message?.extendedTextMessage?.contextInfo?.participant === global.nomorbot;
        
        // Cek apakah ada mention ke bot
        const hasMention = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.includes(global.nomorbot);

        // Ekstrak konten pesan berdasarkan tipe
        if (messageType === 'conversation') {
            messageContent = msg.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            messageContent = msg.message.extendedTextMessage.text;
        } else if (['imageMessage', 'videoMessage', 'documentMessage'].includes(messageType)) {
            messageContent = msg.message[messageType].caption || '';
        }

    // Console message
    console.log(
            chalk.green(`[${new Date().toLocaleTimeString()}]`) + 
            chalk.blue(` Pesan diterima dari `) + chalk.bold(sender) + 
            chalk.yellow(`: "${messageContent}"`) + 
            chalk.magenta(` (Type: ${messageType})`) +
            chalk.cyan(` [Reply: ${isReplyToBot}, Mention: ${hasMention}]`)
        );

    // Multi-prefix
    const prefixes = ['!', '.', ''];
        const prefixUsed = prefixes.find(p => messageContent.startsWith(p)) || '';
        const command = messageContent.slice(prefixUsed.length).split(' ')[0].toLowerCase();
        const args = messageContent
    .slice((prefixUsed + command).length)
    .trim()
    .split(/\s+/);
    
        // Cek tag dan reply
        const isTagged = isTaggingBot(messageContent, global.nomorbot);
        const isReplied = msg.message?.extendedTextMessage?.contextInfo?.participant === global.nomorbot;
        
    function pickRandom(list) {
        return list[Math.floor(list.length * Math.random())]
    }
    
    // Handle tag/reply ke bot
        if (hasMention || isReplyToBot) {
            console.log('Bot sedang ditag atau direply!!');
            await handleAlya(nvdia, msg, messageContent, true);
            return;
        }

        // Handle command alya/ai
        if (['alya'].includes(command)) {
            console.log('Command alya terdeteksi...');
            await handleAlya(nvdia, msg, args.join(' '));
            return;
        }

        // Handle private chat tanpa prefix
        if (!msg.key.fromMe && !isGroup && !prefixUsed) {
            console.log('Private chat terdeteksi...');
            await handleAIPrivate(nvdia, msg, messageContent);
            return;
        }

        if (isTagged || isReplied) {
            await handleAlya(nvdia, msg, messageContent, true);
            return;
        }
  
    switch (command) {
case 'stiker':
case 'sticker':
case 's':
case 'tikel':
    // Cek apakah pesan memiliki media (gambar, video, atau GIF)
    if (
        msg.message?.imageMessage || 
        msg.message?.videoMessage || 
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage ||
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
    ) {
        try {
            // Tentukan apakah itu gambar atau video
            const isImage = msg.message?.imageMessage || 
                            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isVideo = msg.message?.videoMessage || 
                            msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            // Download media
            const buffer = await downloadMediaMessage(
                isImage ? (msg.message.imageMessage ? msg : await msg.getQuotedMessage()) :
                (msg.message.videoMessage ? msg : await msg.getQuotedMessage()), 
                'buffer',
                {}
            );

            // Buat sticker menggunakan wa-sticker-formatter
            const sticker = new Sticker(buffer, {
                pack: 'Sticker', // Nama pack sticker
                author: `Dibuat pada-${jam}`, // Nama author
                type: 'full', // Full sticker
                categories: ['??', '??'], // Kategori sticker
                quality: 50, // Kualitas sticker
                id: `sticker_${Date.now()}`, // Unique ID
                background: 'transparent' // Background transparan
            });

            // Jika ini adalah video, set config tambahan
            if (isVideo) {
                sticker.setFps(10); // Set FPS untuk video/GIF
                sticker.setLoop(true); // Set loop untuk video/GIF
            }

            // Convert ke buffer
            const stickerBuffer = await sticker.toBuffer();

            // Kirim sticker
            await nvdia.sendMessage(msg.key.remoteJid, {
                sticker: stickerBuffer,
                contextInfo: {
                    externalAdReply: {
                    showAdAttribution: true,
                        title: 'Sticker',
                        body: `${jam}`,
                        thumbnailUrl: pickRandom(ftreply),
                        mediaType: 1
                    }
                }
            }, { quoted: msg });

        } catch (mediaError) {
            console.error('Sticker creation error:', mediaError);
            await nvdia.sendMessage(sender, { 
                text: 'Gagal membuat stiker, pastikan media valid dan tidak terlalu besar.' 
            }, { quoted: msg });
        }
    } else {
        await nvdia.sendMessage(sender, { 
            text: 'Kirim gambar/video dengan caption .stiker atau reply gambar/video dengan .stiker' 
        }, { quoted: msg });
    }
    break;
    
        case 'halo':
        let halo = 'Halo apa kabar??'
        nvdia.sendMessage(sender, { text: halo}, { quoted: msg });
      
            break;
          case 'menu':
          let menuk = `*Simple saja menunya✨*
#AI Menu
 • alya 
 • ai
 • blackbox | bb (unstable!)
 • simi (unstable!)
 
#Download Menu
 • fesnuk | fb <link>
 • instagram | ig <link>
 • pinterest <query>
 • pinterest2 | pin2 <link>
 • pinterest3 | pin3 <linkvideo/query>
 • play <link/query> (limit!)
 • play2 <link/query>
 • spotify <link/query>
 • tiktok | tt <link>
 
#Tools Menu
 • info 
 • ping
 • halo
 • neofetch

#Sticker Menu
 • stiker | s | tikel 
 • brat <text>`
           await nvdia.sendMessage(msg.key.remoteJid, {
                text: menuk,
                  ptt: true,
                    contextInfo: {
                    externalAdReply: {
                    showAdAttribution: true,
                        title: 'Alya -',
                        body: `${jam}`,
                        thumbnail: await fs.readFileSync('./lib/image/AlyaThumb.png'),
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: msg });
            break;

        case 'info':
            await reply(nvdia, msg, 'Ini adalah bot WhatsApp sederhana dengan multi-prefix!');
            break;

        case 'ping':
            const startTime = Date.now();
            await reply(nvdia, msg, 'Memeriksa status...');
            const uptime = os.uptime();
            const systemInfo = await systeminformation.getStaticData();
            const cpuInfo = systemInfo.cpu;
            const memoryInfo = systemInfo.mem;

            const pingMessage = `Waktu ping: ${Date.now() - startTime}ms
Uptime: ${formatUptime(uptime)}
OS: ${os.platform()} ${os.release()}
CPU: ${cpuInfo.manufacturer} ${cpuInfo.brand} - ${cpuInfo.speed}GHz
            `;
            await nvdia.sendMessage(msg.key.remoteJid, { 
            text: pingMessage,
             contextInfo: {
               externalAdReply: {
                    showAdAttribution: true,
                        title: 'Pong! ??',
                        body: `${jam}`,
                        thumbnailUrl: pickRandom(ftreply),
                        mediaType: 1
                                  }
                              }
                  }, { quoted: msg });
            break;
            
                  // Command untuk fitur neofetch;
        case 'neofetch':
    exec('neofetch --stdout', (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            reply(nvdia, msg, `Error executing neofetch: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`stderr: ${stderr}`);
            reply(nvdia, msg, `Error: ${stderr}`);
            return;
        }
        nvdia.sendMessage(msg.key.remoteJid, { 
            text: `${stdout}`,
            contextInfo: {
               externalAdReply: {
                    showAdAttribution: true,
                        title: 'Neofetch',
                        body: `${jam}`,
                        thumbnailUrl: pickRandom(ftreply),
                        mediaType: 1
                                  }
                              }
                  }, { quoted: msg });
    });
    break;
            
case 'brat': {
    if (!args.length) {
        nvdia.sendMessage(sender, { text: `Penggunaan: ${prefixUsed + command} <teks>`}, { quoted: msg });
        return;
    }

    try {
        const { createCanvas, registerFont } = require('canvas');
        const Jimp = require('jimp');
        
        registerFont('./lib/font/arialnarrow.ttf', { family: 'ArialNarrow' });

        const canvas = createCanvas(512, 512);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const findOptimalFontSize = (text, maxWidth, maxHeight) => {
            let fontSize = 100;
            ctx.font = `bold ${fontSize}px ArialNarrow`;
            const words = text.split(' ');
            let lines = [];

            while (fontSize > 0) {
                lines = [];
                let currentLine = [];
                let currentWidth = 0;
                ctx.font = `bold ${fontSize}px ArialNarrow`;

                for (const word of words) {
                    const wordWidth = ctx.measureText(word + ' ').width;
                    if (currentWidth + wordWidth <= maxWidth) {
                        currentLine.push(word);
                        currentWidth += wordWidth;
                    } else {
                        if (currentLine.length > 0) {
                            lines.push(currentLine);
                        }
                        currentLine = [word];
                        currentWidth = wordWidth;
                    }
                }
                if (currentLine.length > 0) {
                    lines.push(currentLine);
                }

                const totalHeight = lines.length * (fontSize + 10);
                if (totalHeight <= maxHeight) {
                    break;
                }
                fontSize -= 2;
            }
            return { fontSize, lines };
        };

        const padding = 40;
        const maxWidth = canvas.width - (padding * 2);
        const maxHeight = canvas.height - (padding * 2);
        const text = args.join(' ');
        const { fontSize, lines } = findOptimalFontSize(text, maxWidth, maxHeight);

        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize}px ArialNarrow`;
        
        const lineHeight = fontSize + 10;
        const totalHeight = lines.length * lineHeight;
        const startY = (canvas.height - totalHeight) / 2 + fontSize / 2;

        lines.forEach((line, i) => {
            if (line.length === 1) {
                ctx.textAlign = 'left';
                ctx.fillText(line.join(' '), padding, startY + (i * lineHeight));
            } else {
                const totalSpacing = maxWidth - line.reduce((acc, word) => acc + ctx.measureText(word).width, 0);
                const spaceBetween = line.length > 1 ? totalSpacing / (line.length - 1) : 0;
                
                let currentX = padding;
                line.forEach((word, j) => {
                    ctx.fillText(word, currentX, startY + (i * lineHeight));
                    currentX += ctx.measureText(word).width + spaceBetween;
                });
            }
        });
        
        const buffer = canvas.toBuffer();
        let image = await Jimp.read(buffer);
        image.blur(2);
        
        // Convert Jimp image to buffer
        const imageBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
        
        // Create sticker using wa-sticker-formatter
        const sticker = new Sticker(imageBuffer, {
            pack: 'Sticker', // Nama pack sticker
            author: `Dibuat pada-${jam}`, // Nama author
            type: 'full', // Full sticker
            categories: ['??', '??'], // Kategori sticker
            quality: 50 // Kualitas sticker
        });
        
        // Convert to buffer
        const stickerBuffer = await sticker.toBuffer();
        
        // Kirim sticker
        await nvdia.sendMessage(msg.key.remoteJid, {
                sticker: stickerBuffer,
                  ptt: true,
                    contextInfo: {
                    externalAdReply: {
                    showAdAttribution: true,
                        title: 'Brat sticker',
                        body: `${jam}`,
                        thumbnailUrl: pickRandom(ftreply),
                        mediaType: 1
                    }
                }
            }, { quoted: msg });

    } catch (e) {
        console.error('Error in brat command:', e);
        await reply(nvdia, msg, `Terjadi kesalahan saat membuat stiker: ${e.message}`);
    }
}
break;
case 'bratvideo': {
    const text = args.join(' ');
    if (!text) return reply(nvdia, msg, `Contoh: ${prefixUsed + command} hai`);
    if (text.length > 250) return reply(nvdia, msg, `Karakter terbatas, max 250!`);

    const words = text.split(" ");
    const tempDir = path.join(process.cwd(), 'lib');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    const framePaths = [];

    try {
        for (let i = 0; i < words.length; i++) {
            const currentText = words.slice(0, i + 1).join(" ");

            const res = await axios.get(
                `https://brat.caliphdev.com/api/brat?text=${encodeURIComponent(currentText)}`,
                { responseType: "arraybuffer" }
            );

            const framePath = path.join(tempDir, `frame${i}.mp4`);
            fs.writeFileSync(framePath, res.data);
            framePaths.push(framePath);
        }

        const fileListPath = path.join(tempDir, "filelist.txt");
        let fileListContent = "";

        for (let i = 0; i < framePaths.length; i++) {
            fileListContent += `file '${framePaths[i]}'\n`;
            fileListContent += `duration 0.7\n`;
        }

        fileListContent += `file '${framePaths[framePaths.length - 1]}'\n`;
        fileListContent += `duration 2\n`;

        fs.writeFileSync(fileListPath, fileListContent);
        const outputVideoPath = path.join(tempDir, "output.mp4");
        execSync(
            `ffmpeg -y -f concat -safe 0 -i ${fileListPath} -vf "fps=30" -c:v libx264 -preset ultrafast -pix_fmt yuv420p ${outputVideoPath}`
        );

        await nvdia.sendMessage(msg.key.remoteJid, {
            video: { url: outputVideoPath },
            caption: 'Brat Video Result',
            contextInfo: {
                externalAdReply: {
                showAdAttribution: true,
                    title: 'Brat Video',
                    body: `${jam}`,
                    thumbnailUrl: pickRandom(ftreply),
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });

        // Cleanup
        framePaths.forEach((frame) => {
            if (fs.existsSync(frame)) fs.unlinkSync(frame);
        });
        if (fs.existsSync(fileListPath)) fs.unlinkSync(fileListPath);
        if (fs.existsSync(outputVideoPath)) fs.unlinkSync(outputVideoPath);
    } catch (error) {
        console.error('Brat Video Error:', error);
        reply(nvdia, msg, 'Terjadi kesalahan');
    }
}
break;
case 'bratgen': {
    const text = args.length >= 1 ? args.join(" ") : (
        msg.message?.extendedTextMessage?.text || 
        msg.message?.imageMessage?.caption || 
        null
    );
    
    if (!text) {
        nvdia.sendMessage(sender, { text: `Penggunaan: ${prefixUsed + command} <teks>`}, { quoted: msg });
        return;
    }

    try {
        const response = await axios.get("https://brat.caliphdev.com/api/brat", {
            params: { text },
            responseType: "arraybuffer"
        });

        const imageBuffer = Buffer.from(response.data);
        
        if (imageBuffer.length <= 10240) {
            throw new Error("Failed to generate brat image");
        }

        // Create sticker using wa-sticker-formatter
        const sticker = new Sticker(imageBuffer, {
            pack: 'Sticker',
            author: `Dibuat pada-${jam}`,
            type: 'full',
            categories: ['??', '??'],
            quality: 50
        });
        
        // Convert to buffer
        const stickerBuffer = await sticker.toBuffer();
        
        // Send sticker with external ad reply
        await nvdia.sendMessage(msg.key.remoteJid, {
            sticker: stickerBuffer,
            ptt: true,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: true,
                    title: 'Bratgen sticker',
                    body: `${jam}`,
                    thumbnailUrl: pickRandom(ftreply),
                    mediaType: 1
                }
            }
        }, { quoted: msg });

    } catch (e) {
        console.error('Error in brat command:', e);
        await reply(nvdia, msg, `Terjadi kesalahan saat membuat stiker: ${e.message}`);
    }
}
break;

case 'play': {
    if (!args.length) {
        nvdia.sendMessage(sender, { text: `Masukan judul/link!\ncontoh:\n\n${prefixUsed + command} 1番輝く星\n${prefixUsed + command} https://youtube.com/watch?v=example` }, { quoted: msg });
        return;
    }

    try {
        const searchQuery = args.join(' ');
        const ytRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w\-_]+/;
        let videoInfo, videoUrl;

        // Send initial loading message
        const loadingMsg = await nvdia.sendMessage(sender, { 
            text: '?? Mencari video...'
        }, { quoted: msg });

        if (ytRegex.test(searchQuery)) {
            videoUrl = searchQuery;
            const response = await axios.get(`https://api.botcahx.eu.org/api/dowloader/yt?url=${videoUrl}&apikey=kqj7BEgI`);
            if (!response.data.status) throw new Error('Gagal mendapatkan informasi video');
            videoInfo = response.data.result;
        } else {
            const searchResponse = await axios.get(`https://api.botcahx.eu.org/api/search/yts?query=${encodeURIComponent(searchQuery)}&apikey=kqj7BEgI`);
            if (!searchResponse.data.result || searchResponse.data.result.length === 0) {
                throw new Error('Video tidak ditemukan');
            }
            const firstVideo = searchResponse.data.result[0];
            videoUrl = firstVideo.url;
            
            const downloadResponse = await axios.get(`https://api.botcahx.eu.org/api/dowloader/yt?url=${videoUrl}&apikey=kqj7BEgI`);
            if (!downloadResponse.data.status) throw new Error('Gagal mendapatkan informasi video');
            videoInfo = downloadResponse.data.result;
        }

        // Format duration
        const duration = parseInt(videoInfo.duration);
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Create message with buttons
        await nvdia.sendMessage(sender, {
            image: { url: videoInfo.thumb },
            caption: `*Video Ditemukan!* ✨\n\n*Judul:* ${videoInfo.title}\n*Durasi:* ${formattedDuration}\n\nSilahkan ketik:\n\n*.audio* - untuk download MP3\n*.video* - untuk download MP4`,
            footer: 'Alya✨'
        }, { quoted: msg });

        // Set up state
        setState(sender, 'awaiting_format', {
            videoUrl,
            videoInfo
        });

    } catch (error) {
        console.error("Error pada fitur play:", error);
        
        let errorMsg = 'Terjadi kesalahan saat memproses media.';
        
        if (error.message === 'Video tidak ditemukan') {
            errorMsg = 'Video tidak ditemukan. Silakan coba kata kunci lain.';
        } else if (error.message === 'Gagal mendapatkan informasi video') {
            errorMsg = 'Gagal mendapatkan informasi video. Silakan coba lagi nanti.';
        } else if (error.response && error.response.status === 404) {
            errorMsg = 'API tidak dapat diakses. Silakan coba lagi nanti.';
        } else if (error.code === 'ENOTFOUND') {
            errorMsg = 'Gagal mengakses server. Periksa koneksi internet Anda.';
        }
        
        await reply(nvdia, msg, errorMsg);
    }
}
break;
case 'audio': case 'video': {
    const userState = getState(sender);
    if (!userState || userState.state !== 'awaiting_format') {
        return;
    }

    const { videoInfo } = userState.data;
    const isAudio = command === 'audio';

    try {
        // Send waiting message
        await nvdia.sendMessage(msg.key.remoteJid, { 
            text: `⌛ Mohon tunggu, sedang memproses ${isAudio ? 'audio' : 'video'}...` 
        }, { quoted: msg });

        if (isAudio) {
            // Send audio
            await nvdia.sendMessage(msg.key.remoteJid, {
                audio: { url: videoInfo.mp3 },
                mimetype: 'audio/mpeg',
                fileName: `${videoInfo.title}.mp3`,
                contextInfo: {
                    externalAdReply: {
                        showAdAttribution: true,
                        title: videoInfo.title,
                        body: "Click here to watch on YouTube",
                        mediaType: 2,
                        thumbnailUrl: videoInfo.thumb,
                        mediaUrl: videoInfo.source
                    }
                }
            }, { quoted: msg });
        } else {
            // Send video
            await nvdia.sendMessage(msg.key.remoteJid, {
                video: { url: videoInfo.mp4 },
                caption: `?? *${videoInfo.title}*\n\n⚡ Download By Alya✨`,
                mimetype: 'video/mp4',
                fileName: `${videoInfo.title}.mp4`
            }, { quoted: msg });
        }

    } catch (error) {
        console.error(`Error processing ${isAudio ? 'audio' : 'video'}:`, error);
        await reply(nvdia, msg, `Gagal memproses ${isAudio ? 'audio' : 'video'}. Silakan coba lagi nanti.`);
    } finally {
        userStates.delete(sender);
    }
}
break;

case 'play2': {
    if (!args.length) {
        await reply(nvdia, msg, `Masukan judul!\nContoh: ${prefixUsed + command} 1番輝く星`);
        return;
    }

    await reply(nvdia, msg, '⏳ Mohon tunggu sebentar...');

    try {
        const search = require("yt-search");
        const { youtube } = require("btch-downloader");
        
        // Function untuk get buffer dari URL dengan retry
        async function getBuffer(url, retries = 3) {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await axios({
                        method: 'get',
                        url,
                        responseType: 'arraybuffer',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': '*/*',
                            'Connection': 'keep-alive'
                        },
                        timeout: 30000 // 30 seconds timeout
                    });
                    return response.data;
                } catch (err) {
                    if (i === retries - 1) throw err;
                    await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
                }
            }
        }

        // Function untuk validasi ukuran file
        async function validateAudioUrl(url, minSize = 1024 * 100) { // minimal 100KB
            try {
                const response = await axios.head(url);
                const fileSize = parseInt(response.headers['content-length']);
                if (fileSize < minSize) {
                    throw new Error('File audio terlalu kecil, mencoba mengunduh ulang...');
                }
                return true;
            } catch (error) {
                return false;
            }
        }

        // Function untuk download dengan retry
        async function downloadWithRetry(videoUrl, maxRetries = 3) {
            let lastError;
            
            for (let i = 0; i < maxRetries; i++) {
                try {
                    const result = await youtube(videoUrl);
                    
                    // Validasi ukuran file
                    if (await validateAudioUrl(result.mp3)) {
                        return result;
                    }
                    throw new Error('Invalid file size');
                } catch (err) {
                    lastError = err;
                    if (i < maxRetries - 1) {
                        await reply(nvdia, msg, `?? Percobaan download ke-${i + 2}...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            throw lastError;
        }

        // Cari video
        const query = args.join(' ');
        const searchResults = await search(query);
        const video = searchResults.videos[0];

        if (!video) {
            await reply(nvdia, msg, '❌ Video tidak ditemukan');
            return;
        }

        // Cek durasi
        if (video.seconds >= 3600) {
            await reply(nvdia, msg, '❌ Durasi video lebih dari 1 jam!');
            return;
        }

        // Download dengan retry mechanism
        const audioUrl = await downloadWithRetry(video.url);
        
        // Get thumbnail
        const thumbBuffer = await getBuffer(video.thumbnail);

        // Format views number
        const formattedViews = video.views.toLocaleString('id-ID');

        // Send audio as document with detailed info
        await nvdia.sendMessage(msg.key.remoteJid, {
            document: {
                url: audioUrl.mp3 || audioUrl.url || audioUrl.dlmp3
            },
            mimetype: 'audio/mpeg',
            fileName: `${video.title}.mp3`,
            jpegThumbnail: thumbBuffer,
            caption: `?? *${video.title}*\n⌚ *Durasi:* ${video.timestamp}\n?? *Views:* ${formattedViews}\n?? *Link:* ${video.url}\n\n_Jika file rusak, silakan coba lagi._`
        }, { quoted: msg });

    } catch (error) {
        console.error('Error in play command:', error);
        await reply(nvdia, msg, `❌ Terjadi kesalahan: ${error.message}\nSilakan coba lagi.`);
    }
}
break;
case 'spotify': {
    if (!args.length) {
        nvdia.sendMessage(sender, { text: `Masukan judul/link!\ncontoh:\n\n${prefixUsed + command} 1番輝く星\n${prefixUsed + command} https://open.spotify.com/track/xxxxx`}, { quoted: msg });
        return;
    }

    try {
        const query = args.join(' ');
        const spotifyRegex = /^https?:\/\/open\.spotify\.com\/(track|album|playlist)\/[\w\-]+/;

        if (spotifyRegex.test(query)) {
            // Kode existing untuk handling URL Spotify tetap sama
            // ...
        } else {
            try {
                console.log('Mencari dengan keyword:', query);
                const searchRes = await axios.get(`https://rest.cifumo.xyz/search/spotifys?q=${encodeURIComponent(query)}`);

                if (!searchRes.data || !searchRes.data.result || !searchRes.data.result.length) {
                    throw new Error('Lagu tidak ditemukan');
                }

                const tracks = searchRes.data.result.slice(0, 10);
                
                // Simpan hasil pencarian ke dalam Map dengan ID user sebagai key
                searchResults.set(sender, tracks);
                // Set state user ke 'awaiting_selection'
                setState(sender, 'awaiting_selection', { tracks });

                let message = `*Hasil Pencarian Spotify*\n\nKetik nomor untuk mendownload lagu atau ketik 'cancel' untuk membatalkan.\n\n`;
                tracks.forEach((track, index) => {
                    message += `*${index + 1}.* ${track.title}\n└ Durasi: ${track.duration} | Popularitas: ${track.popularity}\n\n`;
                });
                message += `\nSilakan kirim angka 1-${tracks.length} untuk mendownload lagu yang dipilih.`;

                await nvdia.sendMessage(msg.key.remoteJid, {
                    text: message,
                    contextInfo: {
                        externalAdReply: {
                            showAdAttribution: true,
                            title: 'Spotify search',
                            body: `${jam}`,
                            thumbnailUrl: pickRandom(ftreply),
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });
            } catch (error) {
                console.error('Error pencarian:', error);
                throw error;
            }
        }
    } catch (e) {
        console.error("Error pada fitur spotify:", e);
        await reply(nvdia, msg, `Terjadi kesalahan: ${e.message}`);
    }
}
break;

// Case baru untuk menangani respons angka
case '1': case '2': case '3': case '4': case '5':
case '6': case '7': case '8': case '9': case '10': {
    const userState = getState(sender);
    
    if (!userState || userState.state !== 'awaiting_selection') {
        return;
    }

    const selectedIndex = parseInt(command) - 1;
    const tracks = userState.data.tracks;

    if (selectedIndex < 0 || selectedIndex >= tracks.length) {
        await reply(nvdia, msg, 'Nomor tidak valid. Silakan pilih nomor yang benar.');
        return;
    }

    try {
        const selectedTrack = tracks[selectedIndex];
        
        // Kirim pesan loading
        await nvdia.sendMessage(sender, {
            text: `⌛ Sedang memproses audio...\n\n*Judul:* ${selectedTrack.title}\n*Artis:* ${selectedTrack.artist}`
        }, { quoted: msg });

        // Download lagu menggunakan URL Spotify
        const downloadRes = await axios.get(`https://rest.cifumo.xyz/download/spotifydl?url=${encodeURIComponent(selectedTrack.url)}`);
        
        if (!downloadRes.data || !downloadRes.data.result) {
            throw new Error('Format respons API tidak valid');
        }

        const songData = {
            title: downloadRes.data.result.title,
            artist: downloadRes.data.result.artis,
            thumbnail: downloadRes.data.result.image,
            url: downloadRes.data.result.download,
            duration: downloadRes.data.result.durasi,
            spotifyUrl: selectedTrack.url
        };

        // Kirim audio
        await nvdia.sendMessage(msg.key.remoteJid, {
            audio: { url: songData.url },
            mimetype: 'audio/mpeg',
            ptt: false,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: true,
                    title: songData.title,
                    mediaType: 1,
                    previewType: 1,
                    body: songData.artist,
                    thumbnailUrl: songData.thumbnail,
                    renderLargerThumbnail: true,
                    mediaUrl: songData.spotifyUrl,
                    sourceUrl: songData.spotifyUrl
                }
            }
        }, { quoted: msg });

        // Hapus state setelah selesai
        userStates.delete(sender);

    } catch (error) {
        console.error('Error downloading:', error);
        await reply(nvdia, msg, `Gagal mengunduh lagu: ${error.message}`);
    }
}
break;

case 'cancel': {
    const userState = getState(sender);
    if (userState && userState.state === 'awaiting_selection') {
        userStates.delete(sender);
        await reply(nvdia, msg, 'Pencarian dibatalkan.');
    }
}
break;

case 'test': case 'eval': {
    if (!isCreator) return reply(nvdia, msg, '❌ Fitur ini hanya untuk owner bot!');
    await handleTest(nvdia, msg, args.join(' '));
}
break;
  
case 'ai': case 'claude': {
        await handleAI(nvdia, msg, sender, args, prefixUsed, command);
}
break;

case 'simi': {
                await handleSimiSettings(nvdia, msg, sender, args, prefixUsed, command);
}
break;

case 'bb': case 'blackbox': {
        if (!args.length) {
            await reply(nvdia, msg, `Masukkan pertanyaan!\ncontoh:\n\n${prefixUsed + command} apa itu javascript`);
            return;
        }

        const question = args.join(' ');
        const options = {
            model: 'blackbox', // Bisa diganti dengan model lain
            temperature: 0.7
        };

        await handleBlackboxChat(nvdia, msg, question, options);
    }
break;

case 'ig': case 'instagram': {
    const url = args.length > 0 ? args[0] : '';
    await handleIgram(nvdia, msg, url);
}
break;

case 'tt': case 'tiktok': {
    const url = args.length > 0 ? args[0] : '';
    await handleTtsave(nvdia, msg, url);
}
break;
case 'pinterest': {
    if (!args.length) {
        nvdia.sendMessage(sender, { text: `Masukan kata kunci!\ncontoh:\n\n${prefixUsed + command} Alya` }, { quoted: msg });
        return;
    }

    try {
        // Send initial loading message
        const loadingMsg = await nvdia.sendMessage(sender, { 
            text: '?? Mencari gambar di Pinterest...'
        }, { quoted: msg });

        // Get images from API
        const query = args.join(' ');
        const response = await axios.get(`https://api.ryzendesu.vip/api/search/pinterest?query=${encodeURIComponent(query)}`);
        
        if (!Array.isArray(response.data) || response.data.length === 0) {
            throw new Error('Gambar tidak ditemukan');
        }

        // Save images to state
        setState(sender, 'pinterest_search', {
            images: response.data,
            currentIndex: 0,
            query: query
        });

        // Send first image
        const firstImage = response.data[0];
        await nvdia.sendMessage(sender, {
            image: { url: firstImage },
            caption: `?? Pinterest Image (1/${response.data.length})\n\n?? Hasil pencarian: "${query}"\n\nKetik *.next* untuk gambar selanjutnya\nKetik *.stop* untuk mencari gambar lain`,
        }, { quoted: msg });

    } catch (error) {
        console.error("Error pada fitur pinterest:", error);
        
        let errorMsg = 'Terjadi kesalahan saat mencari gambar.';
        
        if (error.message === 'Gambar tidak ditemukan') {
            errorMsg = 'Tidak ada gambar ditemukan. Silakan coba kata kunci lain.';
        } else if (error.response && error.response.status === 404) {
            errorMsg = 'API tidak dapat diakses. Silakan coba lagi nanti.';
        } else if (error.code === 'ENOTFOUND') {
            errorMsg = 'Gagal mengakses server. Periksa koneksi internet Anda.';
        }
        
        await reply(nvdia, msg, errorMsg);
    }
}
break;

case 'next': {
    const state = getState(sender);
    if (!state || state.state !== 'pinterest_search') {
        await reply(nvdia, msg, '⚠️ Tidak ada pencarian Pinterest yang aktif. Gunakan *.pinterest <kata kunci>* untuk mencari gambar.');
        return;
    }

    try {
        const { images, currentIndex, query } = state.data;
        const nextIndex = currentIndex + 1;

        // Check if we've reached the end
        if (nextIndex >= images.length) {
            await reply(nvdia, msg, '✅ Semua gambar telah ditampilkan. Gunakan *.pinterest <kata kunci>* untuk mencari gambar lain.');
            userStates.delete(sender);
            return;
        }

        // Send next image
        await nvdia.sendMessage(sender, {
            image: { url: images[nextIndex] },
            caption: `?? Pinterest Image (${nextIndex + 1}/${images.length})\n\n?? Hasil pencarian: "${query}"\n\nKetik *.next* untuk gambar selanjutnya\nKetik *.stop* untuk mencari gambar lain`,
        }, { quoted: msg });

        // Update state with new index
        setState(sender, 'pinterest_search', {
            ...state.data,
            currentIndex: nextIndex
        });

    } catch (error) {
        console.error("Error pada fitur next:", error);
        await reply(nvdia, msg, 'Gagal menampilkan gambar selanjutnya. Silakan coba lagi.');
    }
}
break;

case 'stop': {
    const state = getState(sender);
    if (!state || state.state !== 'pinterest_search') {
        await reply(nvdia, msg, '⚠️ Tidak ada pencarian Pinterest yang aktif.');
        return;
    }

    try {
        userStates.delete(sender);
        await reply(nvdia, msg, '✅ Pencarian dihentikan. Gunakan *.pinterest <kata kunci>* untuk mencari gambar baru.');
    } catch (error) {
        console.error("Error pada fitur stop:", error);
        await reply(nvdia, msg, 'Gagal menghentikan pencarian.');
    }
}
break;

case 'pin2': case 'pinterest2': {
    const url = args.length > 0 ? args[0] : '';
    await handlePinterest(nvdia, msg, url);
}
break;
case 'pin3': case 'pinterest3': {
    await handlePinApi(nvdia, msg, args);
    break;
}
case 'next3': {
    await handleNext(nvdia, msg);
    break;
}
case 'stop3': {
    await handleStop(nvdia, msg);
}
break;
case 'fb': case 'fesnuk': {
    const url = args.length > 0 ? args[0] : '';
    await handleFacebook(nvdia, msg, url);
}
break;
case 'd': 
case 'download': {
    const q = args.join(' ');
    if (!q) return reply(nvdia, msg, `*Masukkan URL yang ingin diunduh!*\n\nFormat: download <url>|<platform>`);

    const [url, platform] = q.split('|');
    if (!url || !platform) return reply(nvdia, msg, `*Format tidak valid!*\n\nContoh: download <url>|<platform>`);

    await handleDownload(nvdia, msg, url, platform);
}
break;
case 'cai': {
    if (args.length === 0) {
        await chatbot.handleCharList(nvdia, msg);
        return;
    }
    
    if (args[0].toLowerCase() === 'list') {
        await chatbot.handleCharList(nvdia, msg);
    } else {
        const fullText = args.join(' ');
        await chatbot.handleCharAI(nvdia, msg, fullText);
    }
}
break;
case 'hd': {
    const handleHDUpscale = require('./handlers/ftrHd');
    
    if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
        return reply(nvdia, msg, "Reply foto nya");
    }

    const resolutionOption = parseInt(args[0]);
    if (!resolutionOption) {
        return reply(nvdia, msg, `pakai opsi hd yang memiliki 5 type yaitu

1 = 1080p
2 = 2k
3 = 4k
4 = 8k
5 = 16k
`);
    }

    try {
        const media = msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
        const bufferImage = await downloadMediaMessage(
            { message: { imageMessage: media } }, 
            'buffer',
            {}
        );
        await handleHDUpscale(nvdia, msg, resolutionOption, bufferImage);
    } catch (error) {
        console.error('HD Command Error:', error);
        reply(nvdia, msg, 'Gagal mengunduh atau memproses gambar');
    }
}
break;
}
    
  } catch (error) {
        console.error('Error in message handler:', error);
        await reply(nvdia, msg, `Maaf, terjadi kesalahan: ${error.message}`);
    }
};

// Di bagian awal file, tambahkan state management
const searchResults = new Map();
const userStates = new Map();

// Tambahkan fungsi helper untuk mengelola state
const setState = (userId, state, data = null) => {
    userStates.set(userId, {
        state,
        timestamp: Date.now(),
        data
    });
};

const getState = (userId) => {
    const state = userStates.get(userId);
    if (!state) return null;
    
    // Hapus state jika sudah lebih dari 5 menit
    if (Date.now() - state.timestamp > 5 * 60 * 1000) {
        userStates.delete(userId);
        return null;
    }
    return state;
};

async function reply(nvdia, msg, replyText) {
    if (msg.key && msg.key.remoteJid) {
        await nvdia.sendMessage(msg.key.remoteJid, {
            text: replyText,
            quoted: msg, 
        });
    }
}

function formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${hours} jam, ${minutes} menit, ${remainingSeconds} detik`;
}

// Watching file changes
let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    console.log('\x1b[0;32m' + __filename + ' \x1b[1;32mwas updated!\x1b[0m');
    delete require.cache[file];
    require(file);
});

