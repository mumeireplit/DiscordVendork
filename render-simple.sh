#!/bin/bash

# シンプルなRender用ビルドスクリプト
echo "開始: 超シンプルなRenderビルドプロセス"

# パッケージをコピー
echo "シンプルなpackage.jsonを適用"
cp package.simple.json package.json

# アプリをコピー
echo "シンプルなアプリを準備"
cp render-app.js app.js

# インストール
echo "依存関係のインストール"
npm install

echo "ビルド完了"