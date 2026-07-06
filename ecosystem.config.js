module.exports = {
  apps: [
    {
      name: 'humanapp',
      // 用 tsx 直接跑 server.ts（与 npm run start 一致）
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: 3000,
      },
      // 崩溃自动重启
      autorestart: true,
      // 文件变动不重启（生产环境）
      watch: false,
      // 单实例；socket.io 有状态，不要用 cluster 多实例
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      // 日志
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
