import { handleRequest } from './src/core.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // 加载配置（从 Cloudflare 环境变量读取）
      const config = {
        prefix: env.PREFIX || 'telegram-bot',
        secretToken: env.SECRET_TOKEN || ''
      };

      // 校验必填配置
      if (!config.secretToken) {
        return new Response(JSON.stringify({
          success: false,
          message: '请在 Cloudflare 配置 SECRET_TOKEN 环境变量'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 跨域配置
      const response = await handleRequest(request, config);
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Telegram-Bot-Api-Secret-Token');

      // 处理 OPTIONS 预检请求
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: response.headers
        });
      }

      return response;
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: `服务器错误：${error.message}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};