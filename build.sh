#!/bin/bash

# ビルドスクリプト for Render

# npm インストール
npm install

# ビルドコマンドの実行（npxを使用してローカルにインストールされたパッケージを実行）
npx vite build

# サーバーコードのバンドル
npx esbuild server/index.ts --platform=node --bundle --format=esm --outdir=dist \
  --external:firebase --external:firebase-admin \
  --external:express --external:http --external:ws --external:pg \
  --external:passport --external:passport-local --external:express-session \
  --external:connect-pg-simple --external:memorystore --external:discord.js

# package.jsonをdistフォルダにコピー
cp package.json dist/

# Node.jsモジュールインストールスクリプトの作成
cat > dist/install-modules.js << 'EOL'
const { execSync } = require('child_process');
console.log('Installing Firebase modules...');
execSync('npm install firebase firebase-admin discord.js --omit=dev', {stdio: 'inherit'});
console.log('Modules installed successfully');
EOL

# ビルド完了メッセージ
echo "Build completed successfully!"