// PM2 process config
// .cjs extension required because package.json has "type": "module"
//
// Usage on VM:
//   pm2 start ecosystem.config.cjs
//   pm2 save
//   pm2 startup   <- run the printed command to enable autostart

module.exports = {
  apps: [
    {
      name: 'stuv-copilot',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 80,
      },
    },
  ],
};
