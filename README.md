双向机器人

选项1：Vercel 部署

1. 新建 Vercel 项目，关联代码仓库（GitHub/GitLab）。

2. 配置环境变量（项目 → Settings → Environment Variables）：

◦ SECRET_TOKEN：密钥（16位+大小写+数字，必填）

◦ PREFIX：接口前缀（默认 telegram-bot，可选）

3. 部署完成后，获取 Vercel 域名（如 xxx.vercel.app）。

选项2：Cloudflare Workers 部署

1. 新建 Cloudflare Worker，创建 src 目录并上传 core.js，根目录上传 worker.js。

2. 配置环境变量（Worker → 设置 → 环境变量）：

◦ SECRET_TOKEN：同 Vercel 配置（必填）

◦ PREFIX：同 Vercel 配置（可选）

3. 部署后获取 Worker 域名（如 xxx.workers.dev）。

四、使用流程

1. 创建 Telegram 机器人：向 @BotFather 发送 /newbot，获取 BotToken（格式：123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11）。

2. 获取你的 Telegram UID：向 @userinfobot 发送消息，获取纯数字 UID。

3. 安装 Webhook：访问 https://你的域名/[PREFIX]/install/你的UID/BotToken，返回 success: true 即成功。

4. 功能测试：

◦ 普通用户发消息：触发关键词回复/默认回复，同时转发给主人