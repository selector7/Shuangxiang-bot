import { handleRequest } from '../src/core.js';

export default async function handler(req, res) {
  try {
    // 构建标准 Request 对象（适配 Vercel req 格式）
    const request = new Request(
      `${req.headers['x-forwarded-proto']}://${req.headers.host}${req.url}`,
      {
        method: req.method,
        headers: new Headers(req.headers),
        body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
        duplex: 'half' // 适配 Node.js 流模式
      }
    );

    // 加载配置（从 Vercel 环境变量读取）
    const config = {
      prefix: process.env.PREFIX || 'telegram-bot',
      secretToken: process.env.SECRET_TOKEN || ''
    };

    // 校验必填配置
    if (!config.secretToken) {
      return res.status(500).json({
        success: false,
        message: 'Vercel 未配置 SECRET_TOKEN 环境变量'
      });
    }

    // 调用核心逻辑
    const response = await handleRequest(request, config);

    // 转发响应头
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // 发送响应
    res.status(response.status);
    const body = await response.text();
    res.send(body);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `服务器错误：${error.message}`
    });
  }
}

// 🔥 修复核心：简化 runtime 配置（新版 Vercel 自动适配 Node.js 18+）
export const config = {
  runtime: 'nodejs', // 替换原 nodejs18.x，兼容新版 Vercel CLI
  maxDuration: 10, // 超时10秒保留
  regions: ['iad1', 'sfo1', 'lhr1', 'sin1'] // 全球节点保留
};