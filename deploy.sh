#!/bin/bash
set -e

if [ $# -lt 2 ]; then
  echo "用法: sh deploy.sh <ip> <ssh_key>"
  echo "示例: sh deploy.sh 127.0.0.1 ~/.ssh/id_rsa"
  exit 1
fi

SERVER="ubuntu@$1"
SSH_KEY="$2"
SSH_PORT=7725
REMOTE_DIR="/home/ubuntu/humanapp"

echo ">>> 1. 本地构建..."
npm run build

echo ">>> 2. 打包文件..."
COPYFILE_DISABLE=1 tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='logs' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    -czf /tmp/humanapp-deploy.tar.gz .

echo ">>> 3. 上传到服务器..."
scp -i "$SSH_KEY" -P "$SSH_PORT" /tmp/humanapp-deploy.tar.gz "$SERVER:/tmp/"

echo ">>> 4. 远程部署..."
ssh -T -i "$SSH_KEY" -p "$SSH_PORT" "$SERVER" << 'EOF'
set -e

# 加载 nvm/node 环境
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

REMOTE_DIR="/home/ubuntu/humanapp"

mkdir -p "$REMOTE_DIR"
cd "$REMOTE_DIR"

# 解压覆盖
tar -xzf /tmp/humanapp-deploy.tar.gz -C "$REMOTE_DIR" 2>/dev/null
rm -f /tmp/humanapp-deploy.tar.gz

# 清理 macOS 残留文件
find "$REMOTE_DIR" -name '._*' -delete
find "$REMOTE_DIR" -name '.DS_Store' -delete

# 安装依赖
npm install --omit=dev --silent

# 重启服务
if command -v pm2 &> /dev/null; then
  pm2 delete humanapp 2>/dev/null || true
  pm2 start ecosystem.config.js
else
  echo "⚠️  pm2 未安装，请手动启动: npm run start"
fi

echo "✅ 部署完成！"
EOF

rm -f /tmp/humanapp-deploy.tar.gz
echo ">>> 全部完成！"
