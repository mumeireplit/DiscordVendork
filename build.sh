#!/bin/bash

# ビルドスクリプト for Render

# npm インストール
npm install

# ビルドコマンドの実行（npxを使用してローカルにインストールされたパッケージを実行）
npx vite build

# サーバーコードのバンドル（--external:firebaseを追加してexcludeしない）
npx esbuild server/index.ts --platform=node --bundle --format=esm --outdir=dist \
  --external:express --external:http --external:ws --external:pg \
  --external:passport --external:passport-local --external:express-session \
  --external:connect-pg-simple --external:memorystore

# package.jsonをdistフォルダにコピー
cp package.json dist/

# distディレクトリに移動してfirebase関連パッケージをインストール
cd dist
npm install firebase firebase-admin --omit=dev
cd ..

# ビルド完了メッセージ
echo "Build completed successfully!"