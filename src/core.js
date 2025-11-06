// 自定义回复配置（可按需修改）
const CUSTOM_REPLIES = {
  // 关键词回复（模糊匹配，不区分大小写）
  keywords: [
    {
      trigger: ['你好', 'hi', 'hello', '哈喽'],
      reply: '👋 你好呀！我是双向转发机器人～ 有什么想对我说的，我会同步给主人哦！'
    },
    {
      trigger: ['帮助', 'help', '使用方法'],
      reply: '📚 使用说明：\n1. 直接发消息即可转发给主人\n2. 主人回复后会同步给你\n3. 支持文字、图片、文件等多种消息类型'
    },
    {
      trigger: ['谢谢', 'thanks', '感谢'],
      reply: '😊 不客气～ 有任何问题随时告诉我呀！'
    }
  ],
  // 默认回复（无匹配关键词时触发）
  default: '🤖 收到你的消息啦！主人会尽快回复你，请耐心等待～',
  // 主人专属回复（仅主人给机器人发消息时触发）
  ownerOnly: '👨‍💻 主人你好！已为你开启双向转发模式，用户消息会实时同步给你～'
};

// 关键词匹配工具：判断消息是否包含触发词
function matchKeyword(messageText) {
  if (!messageText) return null;
  const lowerText = messageText.toLowerCase();
  for (const rule of CUSTOM_REPLIES.keywords) {
    const matched = rule.trigger.some(trigger => 
      lowerText.includes(trigger.toLowerCase())
    );
    if (matched) return rule.reply;
  }
  return null;
}

// 密钥校验：16位+大小写字母+数字
export function validateSecretToken(token) {
    return token.length > 15 && /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
}

// 标准 JSON 响应工具
export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'}
    });
}

// 调用 Telegram API
export async function postToTelegramApi(token, method, body) {
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
}

// 安装 Webhook（绑定机器人到服务地址）
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

// 卸载 Webhook
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

// Webhook 消息处理（双向转发+自定义回复核心）
export async function handleWebhook(request, ownerUid, botToken, secretToken) {
    // 校验 Telegram 秘钥
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

    try {
        // 主人直接给机器人发消息 → 专属回复
        if (senderUid === ownerUid && !reply) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: CUSTOM_REPLIES.ownerOnly,
                parse_mode: 'Markdown'
            });
            return new Response('OK');
        }

        // 主人回复消息 → 转发给原发送者
        if (reply && senderUid === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                let senderUid = rm.inline_keyboard[0][0].callback_data;
                if (!senderUid) {
                    senderUid = rm.inline_keyboard[0][0].url.split('tg://user?id=')[1];
                }

                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: parseInt(senderUid),
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }
            return new Response('OK');
        }

        // /start 命令 → 欢迎回复
        if ("/start" === messageText) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: '🎉 欢迎使用双向转发机器人！\n直接发消息即可联系主人，主人会尽快回复你～\n发送「帮助」查看使用说明',
                parse_mode: 'Markdown'
            });
            return new Response('OK');
        }

        // 关键词匹配 → 自定义回复
        const keywordReply = matchKeyword(messageText);
        if (keywordReply) {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: keywordReply,
                parse_mode: 'Markdown'
            });
        } 
        // 无关键词匹配 → 默认回复
        else {
            await postToTelegramApi(botToken, 'sendMessage', {
                chat_id: senderUid,
                text: CUSTOM_REPLIES.default,
                parse_mode: 'Markdown'
            });
        }

        // 普通用户消息 → 转发给主人（带发送者信息）
        const sender = message.chat;
        const senderName = sender.username ? `@${sender.username}` : [sender.first_name, sender.last_name].filter(Boolean).join(' ');

        const copyMessage = async function (withUrl = false) {
            const ik = [[{
                text: `🔏 From: ${senderName} (${senderUid})`,
                callback_data: senderUid,
            }]];

            if (withUrl) {
                ik[0][0].text = `🔓 From: ${senderName} (${senderUid})`;
                ik[0][0].url = `tg://user?id=${senderUid}`;
            }

            return await postToTelegramApi(botToken, 'copyMessage', {
                chat_id: parseInt(ownerUid),
                from_chat_id: message.chat.id,
                message_id: message.message_id,
                reply_markup: {inline_keyboard: ik}
            });
        }

        // 优先尝试带跳转链接的转发，失败则用普通回调
        const response = await copyMessage(true);
        if (!response.ok) {
            await copyMessage();
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('Internal Server Error', {status: 500});
    }
}

// 路由分发（统一入口）
export async function handleRequest(request, config) {
    const {prefix, secretToken} = config;
    const url = new URL(request.url);
    const path = url.pathname;

    // 路由正则（匹配接口路径）
    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);

    let match;

    // 安装路由：/prefix/install/主人UID/BotToken
    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken);
    }

    // 卸载路由：/prefix/uninstall/BotToken
    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken);
    }

    // Webhook 路由：/prefix/webhook/主人UID/BotToken
    if (match = path.match(WEBHOOK_PATTERN)) {
        return handleWebhook(request, match[1], match[2], secretToken);
    }

    return new Response('Not Found', {status: 404});
}