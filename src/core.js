// 优化版自定义回复（移除冗余功能，精简实用）
const CUSTOM_REPLIES = {
  keywords: [
    {
      trigger: ['你好', 'hi', 'hello', '哈喽', '嗨'],
      reply: '👋 你好呀！我是主人的专属双向转发机器人～\n直接发送文字、图片、文件等消息，我会第一时间同步给主人，主人回复后会实时转达给你哦！'
    },
    {
      trigger: ['帮助', 'help', '使用方法', '怎么用'],
      reply: '📋 机器人使用指南：\n1. 发送任意消息 → 自动转发给主人\n2. 主人回复你的消息 → 我会同步通知你\n3. 支持类型：文字、图片、视频、文件、地理位置'
    },
    {
      trigger: ['谢谢', 'thanks', '感谢', '多谢'],
      reply: '😊 不客气～ 能帮你传递消息是我的职责！\n如果有其他需求，欢迎随时告诉我呀～'
    },
    {
      trigger: ['再见', '拜拜', 'byebye'],
      reply: '👋 再见啦！期待下次为你服务～\n如果后续有需要传递的消息，随时回来找我呀！'
    }
  ],
  default: {
    text: '🤖 收到你的文字消息啦！\n主人会尽快查看并回复，请耐心等待～\n（发送「帮助」可查看使用指南）',
    media: '📥 收到你的多媒体消息（图片/视频/文件）！\n已同步转发给主人，主人回复后会第一时间通知你～'
  },
  // 精简主人专属回复（移除冗余功能）
  ownerOnly: '👨‍💻 主人你好！\n✅ 双向转发功能已启用，用户消息会实时同步给你\n📌 回复用户消息时，直接回复我转发的消息即可'
};

// 关键词匹配逻辑（精准+模糊）
function matchKeyword(messageText) {
  if (!messageText) return null;
  const lowerText = messageText.trim().toLowerCase();
  
  // 精准匹配
  const exactMatchRule = CUSTOM_REPLIES.keywords.find(rule => 
    rule.trigger.some(trigger => trigger.toLowerCase() === lowerText)
  );
  if (exactMatchRule) return exactMatchRule.reply;
  
  // 模糊匹配
  const fuzzyMatchRule = CUSTOM_REPLIES.keywords.find(rule => 
    rule.trigger.some(trigger => lowerText.includes(trigger.toLowerCase()))
  );
  return fuzzyMatchRule ? fuzzyMatchRule.reply : null;
}

// 密钥校验
export function validateSecretToken(token) {
    return token.length > 15 && /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
}

// 标准JSON响应
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'}
    });
}

// 调用Telegram API
export async function postToTelegramApi(token, method, body) {
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
}

// 安装Webhook
export async function handleInstall(request, ownerUid, botToken, prefix, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const webhookUrl = `${baseUrl}/${prefix}/webhook/${ownerUid}/${botToken}`;

    try {
        const response = await postToTelegramApi(botToken, 'setWebhook', {
            url: webhookUrl,
            allowed_updates: ['message'],
            secret_token: secretToken
        });

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully installed.'});
        }

        return jsonResponse({success: false, message: `Failed to install webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error installing webhook: ${error.message}`}, 500);
    }
}

// 卸载Webhook
export async function handleUninstall(botToken, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    try {
        const response = await postToTelegramApi(botToken, 'deleteWebhook', {});
        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully uninstalled.'});
        }

        return jsonResponse({success: false, message: `Failed to uninstall webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error uninstalling webhook: ${error.message}`}, 500);
    }
}

// 修复：将去重变量声明在函数外部（避免static关键字错误）
let lastMessageId = null;

// Webhook消息处理（移除冗余+美化格式+去重）
export async function handleWebhook(request, ownerUid, botToken, secretToken) {
    if (secretToken !== request.headers.get('X-Telegram-Bot-Api-Secret-Token')) {
        return new Response('Unauthorized', {status: 401});
    }

    const update = await request.json();
    if (!update.message) {
        return new Response('OK');
    }

    const message = update.message;
    const reply = message.reply_to_message;
    const messageText = message.text || '';
    const senderUid = message.chat.id.toString();

    // 消息去重：避免重复处理同一消息
    if (message.message_id === lastMessageId) {
        return new Response('OK');
    }
    lastMessageId = message.message_id;

    try {
        // 主人直接发消息 → 精简专属回复
        if (senderUid === ownerUid && !reply) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: CUSTOM_REPLIES.ownerOnly,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            return new Response('OK');
        }

        // 主人回复消息 → 转发给原用户
        if (reply && senderUid === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                let targetUid = rm.inline_keyboard[0][0].callback_data;
                if (!targetUid) {
                    targetUid = rm.inline_keyboard[0][0].url.split('tg://user?id=')[1];
                }

                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: parseInt(targetUid),
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }
            return new Response('OK');
        }

        // /start命令 → 欢迎回复
        if ("/start" === messageText) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: '🎉 欢迎使用双向转发机器人！\n直接发消息即可联系主人，主人会尽快回复你～\n发送「帮助」查看详细使用说明',
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
            return new Response('OK');
        }

        // 关键词匹配 → 自定义回复
        const keywordReply = matchKeyword(messageText);
        if (keywordReply) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: keywordReply,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        } 
        // 无关键词 → 区分文本/多媒体默认回复
        else {
            let defaultReply;
            if (message.text) {
                defaultReply = CUSTOM_REPLIES.default.text;
            } else if (message.photo || message.video || message.document || message.audio || message.location) {
                defaultReply = CUSTOM_REPLIES.default.media;
            } else {
                defaultReply = CUSTOM_REPLIES.default.text;
            }
            
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: defaultReply,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });
        }

        // 用户消息 → 美化格式后转发给主人
        const sender = message.chat;
        const senderName = sender.username ? `@${sender.username}` : [sender.first_name, sender.last_name].filter(Boolean).join(' ');

        const copyMessage = async function (withUrl = false) {
            const ik = [[{
                // 美化转发卡片：清晰展示用户信息
                text: `👤 消息来自：${senderName}\n🆔 用户ID：${senderUid}`,
                callback_data: senderUid,
            }]];

            if (withUrl) {
                ik[0][0].url = `tg://user?id=${senderUid}`;
            }

            return await postToTelegramApi(botToken, 'copyMessage', {
                chat_id: parseInt(ownerUid),
                from_chat_id: message.chat.id,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {inline_keyboard: ik}
            });
        }

        const response = await copyMessage(true);
        if (!response.ok) {
            await copyMessage();
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response(`Internal Server Error: ${error.message}`, {status: 500});
    }
}

// 路由分发
export async function handleRequest(request, config) {
    const {prefix, secretToken} = config;
    const url = new URL(request.url);
    const path = url.pathname;

    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);

    let match;

    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken);
    }

    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken);
    }

    if (match = path.match(WEBHOOK_PATTERN)) {
        return handleWebhook(request, match[1], match[2], secretToken);
    }

    return new Response('Not Found', {status: 404});
}