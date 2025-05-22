// Render専用のサーバーファイル
// 完全にスタンドアロンで動作するExpressサーバー

import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

// シンプルなメモリ内ストレージ（Render用）
const storage = {
  // サンプルアイテム
  items: [
    { id: 1, name: "プレミアムロール", description: "サーバー内で特別な役割を付与します", price: 1000, stock: 50 },
    { id: 2, name: "カスタム絵文字", description: "あなただけのカスタム絵文字を追加します", price: 500, stock: 100 },
    { id: 3, name: "プライベートチャネル", description: "特別なプライベートチャネルへのアクセス", price: 2000, stock: 5 }
  ],

  // APIメソッド
  getItems: async function() {
    return this.items;
  },
  
  getTransactions: async function() {
    return [];
  },
  
  getDiscordUsers: async function() {
    return [];
  }
};

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

// APIルート
app.get('/api/items', async (_req, res) => {
  try {
    const items = await storage.getItems();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: '商品の取得に失敗しました' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    // 商品の統計情報を取得
    const items = await storage.getItems();
    const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
    const lowStockItems = items.filter(item => item.stock < 5).length;
    
    // トランザクションの統計情報を取得
    const transactions = await storage.getTransactions();
    const totalSales = transactions.length;
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    // ユーザー統計情報を取得
    const discordUsers = await storage.getDiscordUsers();
    const userCount = discordUsers.length;
    const newUsers = 0; // 実際には期間指定して計算する必要あり
    
    // 売上成長率 (仮の値)
    const salesGrowth = 0;
    
    res.json({
      totalSales,
      totalRevenue,
      totalStock,
      lowStockItems,
      userCount,
      newUsers,
      salesGrowth
    });
  } catch (err) {
    res.status(500).json({ error: '統計情報の取得に失敗しました' });
  }
});

// サーバーの作成と起動
const server = http.createServer(app);
server.listen(PORT, () => {
  log(`serving on port ${PORT}`);
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