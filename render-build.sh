#!/bin/bash

# Render用のビルドスクリプト
echo "開始: Renderのビルドプロセス"

# 必要なグローバルパッケージのインストール
echo "グローバルパッケージのインストール"
npm install -g vite esbuild

# 依存関係のインストール
echo "依存関係のインストール"
npm ci

# フロントエンドのビルド
echo "Viteでフロントエンドをビルド"
cd client && ../node_modules/.bin/vite build && cd ..

# バックエンドのビルド
echo "esbuildでバックエンドをビルド"
./node_modules/.bin/esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "ビルド完了"