#!/bin/bash

# ビルドスクリプト for Render

# npm インストール
npm install

# ビルドコマンドの実行（npxを使用してローカルにインストールされたパッケージを実行）
npx vite build
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# ビルド完了メッセージ
echo "Build completed successfully!"