#!/bin/bash

# シンプルなRender用ビルドスクリプト
echo "開始: 超シンプルなRenderビルドプロセス"

# パッケージをコピー
echo "シンプルなpackage.jsonを適用"
cp package.simple.json package.json

# publicディレクトリを作成
echo "publicディレクトリを作成"
mkdir -p public

# 管理画面をコピー
echo "管理画面を準備"
# ファイルは既にpublicディレクトリ内にあるのでコピー不要

# アプリをコピー
echo "シンプルなアプリを準備"
cp render-app.js app.js

# インストール
echo "依存関係のインストール"
npm install

echo "ビルド完了"