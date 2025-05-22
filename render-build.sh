#!/bin/bash

# Render用のビルドスクリプト（革新的アプローチ）
echo "開始: Renderのビルドプロセス（viteを使わない方法）"

# 依存関係のインストール
echo "依存関係のインストール"
npm ci

# カスタムビルドスクリプトを実行
echo "カスタムビルドスクリプトを実行"
node static-build.js

echo "ビルド完了"