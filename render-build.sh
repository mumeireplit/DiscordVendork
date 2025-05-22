#!/bin/bash

# Render用のビルドスクリプト（革新的アプローチ）
echo "開始: Renderのビルドプロセス（viteを使わない方法）"

# 依存関係のインストール
echo "依存関係のインストール"
npm ci

# バックエンドのみをビルド
echo "esbuildでサーバーをビルド"
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

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
    </div>
  </body>
</html>
EOF

# package.jsonのスタートスクリプトを修正
echo "環境設定の修正"
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=10000
EOF

echo "ビルド完了"