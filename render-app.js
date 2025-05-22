// Renderで動作する超シンプルなExpressサーバー
// 依存関係最小でAPI機能のみ実装 - 拡張版

import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

// シンプルなデータストア
let items = [
  { id: 1, name: "プレミアムロール", description: "サーバー内で特別な役割を付与します", price: 1000, stock: 50 },
  { id: 2, name: "カスタム絵文字", description: "あなただけのカスタム絵文字を追加します", price: 500, stock: 100 },
  { id: 3, name: "プライベートチャネル", description: "特別なプライベートチャネルへのアクセス", price: 2000, stock: 5 }
];

// シンプルなトランザクション記録
let transactions = [];
// Discord ユーザー (シンプル版)
let users = [];

// 基本設定
app.use(express.json());

// CORSミドルウェア - より寛容な設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // プリフライトリクエストへの応答
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// APIルート
app.get('/api/items', (_req, res) => {
  res.json(items);
});

// 特定のアイテムを取得
app.get('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  const item = items.find(i => i.id === itemId);
  
  if (!item) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  res.json(item);
});

// 商品の追加 (シンプルな実装)
app.post('/api/items', (req, res) => {
  const { name, description, price, stock } = req.body;
  
  if (!name || !description || !price || !stock) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  
  const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  
  const newItem = {
    id: newId,
    name,
    description,
    price: parseInt(price),
    stock: parseInt(stock)
  };
  
  items.push(newItem);
  res.status(201).json(newItem);
});

// 価格変更API
app.patch('/api/items/:id/price', (req, res) => {
  const itemId = parseInt(req.params.id);
  const { price } = req.body;
  
  if (!price || isNaN(parseInt(price))) {
    return res.status(400).json({ error: '有効な価格を指定してください' });
  }
  
  const itemIndex = items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  items[itemIndex].price = parseInt(price);
  res.json(items[itemIndex]);
});

// 在庫更新API
app.patch('/api/items/:id/stock', (req, res) => {
  const itemId = parseInt(req.params.id);
  const { stock } = req.body;
  
  if (stock === undefined || isNaN(parseInt(stock))) {
    return res.status(400).json({ error: '有効な在庫数を指定してください' });
  }
  
  const itemIndex = items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  items[itemIndex].stock = parseInt(stock);
  res.json(items[itemIndex]);
});

// 商品削除API
app.delete('/api/items/:id', (req, res) => {
  const itemId = parseInt(req.params.id);
  
  const itemIndex = items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  const deletedItem = items[itemIndex];
  items = items.filter(i => i.id !== itemId);
  
  res.json(deletedItem);
});

// 購入処理のシンプル実装
app.post('/api/purchase', (req, res) => {
  const { userId, itemId, quantity = 1 } = req.body;
  
  if (!userId || !itemId) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  
  const itemIndex = items.findIndex(i => i.id === parseInt(itemId));
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  const item = items[itemIndex];
  
  if (item.stock < quantity) {
    return res.status(400).json({ error: '在庫が不足しています' });
  }
  
  // 購入処理
  items[itemIndex].stock -= quantity;
  
  // トランザクション記録
  const transaction = {
    id: transactions.length + 1,
    userId,
    itemId: item.id,
    quantity,
    amount: item.price * quantity,
    createdAt: new Date().toISOString()
  };
  
  transactions.push(transaction);
  
  res.json({ 
    success: true, 
    message: `${item.name}を${quantity}個購入しました`,
    transaction
  });
});

app.get('/api/stats', (_req, res) => {
  const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
  const lowStockItems = items.filter(item => item.stock < 5).length;
  
  // トランザクションベースの統計
  const totalSales = transactions.reduce((sum, tx) => sum + tx.quantity, 0);
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
  res.json({
    totalSales,
    totalRevenue,
    totalStock,
    lowStockItems,
    userCount: users.length,
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
          .endpoint { background: #e9f5ff; padding: 0.5rem; border-radius: 0.3rem; margin-bottom: 0.5rem; }
          .method { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.2rem; font-size: 0.8rem; margin-right: 0.5rem; }
          .get { background: #61affe; color: white; }
          .post { background: #49cc90; color: white; }
          .patch { background: #fca130; color: white; }
          .delete { background: #f93e3e; color: white; }
        </style>
      </head>
      <body>
        <h1>Discord Vending Bot API</h1>
        <p>このサーバーはDiscord Botのバックエンドとして動作しています。</p>
        
        <h2>利用可能なAPIエンドポイント:</h2>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/items">/api/items</a> - 商品一覧を取得
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/items/1">/api/items/:id</a> - 特定の商品を取得
        </div>
        
        <div class="endpoint">
          <span class="method post">POST</span> /api/items - 新しい商品を追加
        </div>
        
        <div class="endpoint">
          <span class="method patch">PATCH</span> /api/items/:id/price - 商品の価格を変更
        </div>
        
        <div class="endpoint">
          <span class="method patch">PATCH</span> /api/items/:id/stock - 商品の在庫数を更新
        </div>
        
        <div class="endpoint">
          <span class="method delete">DELETE</span> /api/items/:id - 商品を削除
        </div>
        
        <div class="endpoint">
          <span class="method post">POST</span> /api/purchase - 商品を購入
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/stats">/api/stats</a> - 統計情報を取得
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/debug">/api/debug</a> - デバッグ情報を表示
        </div>
        
        <h2>商品一覧サンプル:</h2>
        <pre>${JSON.stringify(items, null, 2)}</pre>
        
        <h2>テスト用リンク (ブラウザから直接変更可能):</h2>
        <ul>
          <li><a href="/api/test/price/1/1200">商品ID:1の価格を1200に変更</a></li>
          <li><a href="/api/test/price/2/600">商品ID:2の価格を600に変更</a></li>
          <li><a href="/api/test/stock/1/60">商品ID:1の在庫を60に変更</a></li>
          <li><a href="/api/test/stock/2/120">商品ID:2の在庫を120に変更</a></li>
        </ul>
        
        <h2>使用例 (curl):</h2>
        <pre>
# 商品一覧を取得
curl -X GET https://discordvendorbot.onrender.com/api/items

# 在庫を更新 (ID:1の商品を在庫60に)
curl -X PATCH https://discordvendorbot.onrender.com/api/items/1/stock \\
  -H "Content-Type: application/json" \\
  -d '{"stock": 60}'

# 価格を変更 (ID:2の商品を600円に)
curl -X PATCH https://discordvendorbot.onrender.com/api/items/2/price \\
  -H "Content-Type: application/json" \\
  -d '{"price": 600}'

# 商品を購入
curl -X POST https://discordvendorbot.onrender.com/api/purchase \\
  -H "Content-Type: application/json" \\
  -d '{"userId": "123456", "itemId": 1, "quantity": 2}'
</pre>
      </body>
    </html>
  `);
});

// デバッグエンドポイント
app.get('/api/debug', (_req, res) => {
  res.json({
    items: items.length,
    transactions: transactions.length,
    users: users.length,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// テスト用の価格変更エンドポイント (GETでアクセス可能）
app.get('/api/test/price/:id/:price', (req, res) => {
  const itemId = parseInt(req.params.id);
  const price = parseInt(req.params.price);
  
  if (isNaN(price)) {
    return res.status(400).json({ error: '有効な価格を指定してください' });
  }
  
  const itemIndex = items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  const oldPrice = items[itemIndex].price;
  items[itemIndex].price = price;
  
  res.json({
    success: true,
    message: `商品ID:${itemId}の価格を${oldPrice}から${price}に変更しました`,
    item: items[itemIndex]
  });
});

// テスト用の在庫変更エンドポイント (GETでアクセス可能）
app.get('/api/test/stock/:id/:stock', (req, res) => {
  const itemId = parseInt(req.params.id);
  const stock = parseInt(req.params.stock);
  
  if (isNaN(stock)) {
    return res.status(400).json({ error: '有効な在庫数を指定してください' });
  }
  
  const itemIndex = items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({ error: '商品が見つかりません' });
  }
  
  const oldStock = items[itemIndex].stock;
  items[itemIndex].stock = stock;
  
  res.json({
    success: true,
    message: `商品ID:${itemId}の在庫を${oldStock}から${stock}に変更しました`,
    item: items[itemIndex]
  });
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