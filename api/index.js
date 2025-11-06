import { handleRequest } from '../src/core.js';

export default async function handler(req, res) {
  try {
    // 🔥 1. 修复请求 URL：确保路径包含 /api/，适配 Vercel 路由规则
    const requestUrl = `${req.headers['x-forwarded-proto']}://${req.headers.host}${req.url}`;
    // 构建标准 Request 对象（无需改，保留你原逻辑）
    const request = new Request(requestUrl, {
      method: req.method,
      headers: new Headers(req.headers),
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      duplex: 'half'
    });

    // 🔥 2. 配置 prefix 为 empty（因为 URL 已包含 /api/，无需额外前缀）
    const config = {
      prefix: '', // 关键：清空前缀，让路由直接匹配 /api/install/...
      secretToken: process.env.SECRET_TOKEN || ''
    };

    // 校验必填配置（不变）
    if (!config.secretToken) {
      return res.status(500).json({
        success: false,
        message: 'Vercel 未配置 SECRET_TOKEN 环境变量'
      });
    }

    // 调用核心逻辑（不变）
    const response = await handleRequest(request, config);

    // 转发响应头和响应体（不变）
    response.headers.forEach((value, key) => res.setHeader(key, value));
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

// 免费版兼容配置（不变）
export const config = {
  runtime: 'nodejs',
  maxDuration: 10
};