// Renderで動作する超シンプルなExpressサーバー
// 依存関係最小でAPI機能のみ実装

import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

// サンプルデータ
const items = [
  { id: 1, name: "プレミアムロール", description: "サーバー内で特別な役割を付与します", price: 1000, stock: 50 },
  { id: 2, name: "カスタム絵文字", description: "あなただけのカスタム絵文字を追加します", price: 500, stock: 100 },
  { id: 3, name: "プライベートチャネル", description: "特別なプライベートチャネルへのアクセス", price: 2000, stock: 5 }
];

// 基本設定
app.use(express.json());

// CORSミドルウェア
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// APIルート
app.get('/api/items', (_req, res) => {
  res.json(items);
});

app.get('/api/stats', (_req, res) => {
  const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
  const lowStockItems = items.filter(item => item.stock < 5).length;
  
  // サンプル統計データ
  res.json({
    totalSales: 0,
    totalRevenue: 0,
    totalStock,
    lowStockItems,
    userCount: 0,
    newUsers: 0,
    salesGrowth: 0
  });
});

// ルートパス
app.get('/', (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Discord Vending Bot API</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
          h1 { color: #6562FA; }
          pre { background: #f1f1f1; padding: 1rem; border-radius: 0.5rem; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Discord Vending Bot API</h1>
        <p>このサーバーはDiscord Botのバックエンドとして動作しています。</p>
        
        <h2>利用可能なAPIエンドポイント:</h2>
        <ul>
          <li><a href="/api/items">/api/items</a> - 商品一覧を取得</li>
          <li><a href="/api/stats">/api/stats</a> - 統計情報を取得</li>
        </ul>
        
        <h2>商品一覧サンプル:</h2>
        <pre>${JSON.stringify(items, null, 2)}</pre>
      </body>
    </html>
  `);
});

// エラーハンドリング
app.use((err, _req, res, _next) => {
  console.error(`エラー: ${err.message}`);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: ポート ${PORT}`);
});