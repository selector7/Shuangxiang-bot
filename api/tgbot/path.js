import { handleRequest } from '../../src/core.js';

export default async function handler(req, res) {
  try {
    // 🔥 关键：重构请求 URL，让 core.js 能匹配路由
    const { path } = req.query; // 动态路由参数（获取 /tgbot/ 后的所有路径）
    const fullPath = Array.isArray(path) ? path.join('/') : path || '';
    const requestUrl = `${req.headers['x-forwarded-proto']}://${req.headers.host}/tgbot/${fullPath}`;

    // 构建标准 Request 对象
    const request = new Request(requestUrl, {
      method: req.method,
      headers: new Headers(req.headers),
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      duplex: 'half'
    });

    // 加载配置（PREFIX 固定为 tgbot，和路径一致）
    const config = {
      prefix: 'tgbot', // 必须和文件夹名一致，无需环境变量
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

    // 转发响应头和响应体
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

// 最终简化配置（免费版兼容）
export const config = {
  runtime: 'nodejs',
  maxDuration: 10
};