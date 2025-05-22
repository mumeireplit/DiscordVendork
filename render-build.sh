#!/bin/bash

# Render用のビルドスクリプト
echo "開始: Renderのビルドプロセス"

# 依存関係のインストール
echo "依存関係のインストール"
npm ci

# vite設定を一時的に修正
echo "Vite設定を修正"
cat <<EOT > vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
EOT

# フロントエンドのビルド
echo "Viteでフロントエンドをビルド"
npx vite build --config vite.config.js

# バックエンドのビルド
echo "esbuildでバックエンドをビルド"
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "ビルド完了"