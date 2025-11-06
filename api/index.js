import { handleRequest } from '../src/core.js';

export default async function handler(req, res) {
  try {
    // 提取/api/后的路径（如/api/public/install/... → public/install/...）
    const pathAfterApi = req.url.replace(/^\/api\//, '');
    // 重构完整请求URL，强制prefix为"public"（与你配置一致）
    const requestUrl = `${req.headers['x-forwarded-proto']}://${req.headers.host}/public/${pathAfterApi}`;

    // 构建标准Request
    const request = new Request(requestUrl, {
      method: req.method,
      headers: new Headers(req.headers),
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      duplex: 'half'
    });

    // 配置（固定prefix为public，确保路由匹配）
    const config = {
      prefix: 'public',
      secretToken: process.env.SECRET_TOKEN || ''
    };

    // 校验配置
    if (!config.secretToken) {
      return res.status(500).json({ success: false, message: 'SECRET_TOKEN未配置' });
    }

    // 调用核心逻辑
    const response = await handleRequest(request, config);

    // 转发响应
    response.headers.forEach((v, k) => res.setHeader(k, v));
    res.status(response.status).send(await response.text());
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export const config = { runtime: 'nodejs', maxDuration: 10 };