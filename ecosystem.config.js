module.exports = {
  apps: [
    {
      name: 'humanapp',
      script: 'dist/server.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        HOSTNAME: '0.0.0.0',
        PORT: 8025,
      },
      autorestart: true,
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
