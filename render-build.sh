#!/bin/bash

# Render用のビルドスクリプト（シンプルなアプローチ）
echo "開始: Renderのビルドプロセス（単独サーバーを使用）"

# 依存関係のインストール
echo "依存関係のインストール"
npm ci

# サーバーコードをコピー
echo "Render専用サーバーを準備"
cp render-server.js dist-server.js

# 静的ファイルのディレクトリを作成
mkdir -p dist/public

# 必要なHTMLファイルを生成
echo "HTMLファイルを生成中..."
cat > dist/public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Discord Vending Bot</title>
  </head>
  <body>
    <div id="root">
      <h1>Discord Vending Bot</h1>
      <p>APIサーバーは正常に動作しています。</p>
      <p>このサーバーはDiscord Botとして機能します。</p>
    </div>
  </body>
</html>
EOF

# Render用のpackage.jsonを使用
echo "Render用package.jsonを適用"
cp package.render.json package.json

# 環境設定の修正
echo "環境設定の修正"
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=10000
EOF

echo "ビルド完了"