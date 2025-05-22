// このファイルはRenderでのデプロイ時に使用するためのスタートポイントです
// viteへの依存を持たない、シンプルなExpressサーバー

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { registerRoutes } from './server/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

// ロギング関数
function log(message, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// 基本設定
app.use(express.json());

// 静的ファイルの配信
const distPath = path.resolve(__dirname, "dist/public");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  log('警告: 静的ファイルのディレクトリが見つかりません: ' + distPath);
}

// APIルートの登録
registerRoutes(app).then(server => {
  // サーバーの起動
  server.listen(PORT, () => {
    log(`serving on port ${PORT}`);
  });
}).catch(err => {
  log('サーバー起動エラー: ' + err.message, 'error');
  process.exit(1);
});

// ファイルが存在しない場合はindex.htmlにフォールバック
app.use("*", (req, res) => {
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

// エラーハンドリング
app.use((err, _req, res, _next) => {
  log(`エラー: ${err.message}`, 'error');
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});