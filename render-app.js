// Renderで動作する超シンプルなExpressサーバー
// API機能 + Discordボット機能

import express from 'express';
import { 
  Client, 
  Events, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} from 'discord.js';
import 'dotenv/config'; // dotenvをインポートして.envファイルを読み込む

const app = express();
const PORT = process.env.PORT || 10000;

// Discordクライアントの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

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
app.use(express.static('public'));

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
  
  // 今日の売上
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaysSales = transactions
    .filter(tx => new Date(tx.createdAt) >= today)
    .reduce((sum, tx) => sum + tx.amount, 0);
    
  // 過去7日間の売上
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  lastWeek.setHours(0, 0, 0, 0);
  const weekSales = transactions
    .filter(tx => new Date(tx.createdAt) >= lastWeek)
    .reduce((sum, tx) => sum + tx.amount, 0);
  
  const salesGrowth = transactions.length >= 2 ? 5 : 0; // サンプルの成長率
  
  res.json({
    totalSales,
    totalRevenue,
    totalStock,
    lowStockItems,
    userCount: users.length,
    newUsers: users.length > 0 ? 1 : 0,
    salesGrowth,
    todaysSales,
    weekSales,
    botStatus: token ? 'online' : 'offline'
  });
});

// トランザクション履歴の取得
app.get('/api/transactions', (_req, res) => {
  res.json(transactions);
});

// ユーザー一覧の取得
app.get('/api/users', (_req, res) => {
  res.json(users);
});

// 設定情報の取得・更新API
app.get('/api/settings', (_req, res) => {
  res.json({
    purchaseSuccessMessage,
    purchaseFailureMessage,
    lowStockNotificationMessage,
    itemTemplates,
    botStatus: token ? 'online' : 'offline'
  });
});

app.post('/api/settings', (req, res) => {
  const { 
    purchaseSuccess, 
    purchaseFailure, 
    lowStockNotification,
    templates
  } = req.body;
  
  if (purchaseSuccess) {
    purchaseSuccessMessage = purchaseSuccess;
  }
  
  if (purchaseFailure) {
    purchaseFailureMessage = purchaseFailure;
  }
  
  if (lowStockNotification) {
    lowStockNotificationMessage = lowStockNotification;
  }
  
  if (templates) {
    // 個別のテンプレートを更新
    if (templates.premium) {
      itemTemplates.premium = {
        ...itemTemplates.premium,
        ...templates.premium
      };
    }
    
    if (templates.emoji) {
      itemTemplates.emoji = {
        ...itemTemplates.emoji,
        ...templates.emoji
      };
    }
    
    if (templates.channel) {
      itemTemplates.channel = {
        ...itemTemplates.channel,
        ...templates.channel
      };
    }
  }
  
  res.json({
    success: true,
    message: '設定が更新されました',
    settings: {
      purchaseSuccessMessage,
      purchaseFailureMessage,
      lowStockNotificationMessage,
      itemTemplates,
      botStatus: token ? 'online' : 'offline'
    }
  });
});

// 特定の商品テンプレートを取得
app.get('/api/templates/:type', (req, res) => {
  const templateType = req.params.type;
  
  if (!itemTemplates[templateType]) {
    return res.status(404).json({ error: 'テンプレートが見つかりません' });
  }
  
  res.json(itemTemplates[templateType]);
});

// 特定の商品テンプレートを更新
app.post('/api/templates/:type', (req, res) => {
  const templateType = req.params.type;
  const updates = req.body;
  
  if (!itemTemplates[templateType]) {
    return res.status(404).json({ error: 'テンプレートが見つかりません' });
  }
  
  // テンプレートを更新
  itemTemplates[templateType] = {
    ...itemTemplates[templateType],
    ...updates
  };
  
  res.json({
    success: true,
    message: `${templateType}テンプレートが更新されました`,
    template: itemTemplates[templateType]
  });
});

// データバックアップ取得API
app.get('/api/backup', (_req, res) => {
  const data = {
    items,
    transactions,
    users,
    settings: {
      purchaseSuccessMessage,
      purchaseFailureMessage,
      lowStockNotificationMessage
    },
    timestamp: new Date().toISOString()
  };
  
  res.json(data);
});

// データ復元API
app.post('/api/restore', (req, res) => {
  try {
    const { items: newItems, transactions: newTransactions, users: newUsers, settings } = req.body;
    
    if (Array.isArray(newItems)) {
      items = newItems;
    }
    
    if (Array.isArray(newTransactions)) {
      transactions = newTransactions;
    }
    
    if (Array.isArray(newUsers)) {
      users = newUsers;
    }
    
    if (settings) {
      if (settings.purchaseSuccessMessage) {
        purchaseSuccessMessage = settings.purchaseSuccessMessage;
      }
      
      if (settings.purchaseFailureMessage) {
        purchaseFailureMessage = settings.purchaseFailureMessage;
      }
      
      if (settings.lowStockNotificationMessage) {
        lowStockNotificationMessage = settings.lowStockNotificationMessage;
      }
    }
    
    res.json({
      success: true,
      message: 'データが復元されました',
      count: {
        items: items.length,
        transactions: transactions.length,
        users: users.length
      }
    });
  } catch (error) {
    console.error('データ復元エラー:', error);
    res.status(400).json({
      success: false,
      message: 'データ復元に失敗しました',
      error: error.message
    });
  }
});

// 管理画面
app.get('/admin', (_req, res) => {
  res.sendFile('admin.html', { root: 'public' });
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
          .status { padding: 0.5rem; border-radius: 0.3rem; margin-top: 1rem; }
          .online { background: #d4edda; color: #155724; }
          .offline { background: #f8d7da; color: #721c24; }
        </style>
      </head>
      <body>
        <h1>Discord Vending Bot API</h1>
        <p>このサーバーはDiscord Botのバックエンドとして動作しています。</p>
        
        <div class="status ${token ? 'online' : 'offline'}">
          <strong>Bot状態:</strong> ${token ? 'オンライン' : 'オフライン'} 
          ${!token ? '(環境変数 DISCORD_BOT_TOKEN が設定されていません)' : ''}
        </div>
        
        <h2>利用可能なAPIエンドポイント:</h2>
        
        <h3>商品関連</h3>
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
        
        <h3>取引・統計関連</h3>
        <div class="endpoint">
          <span class="method post">POST</span> /api/purchase - 商品を購入
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/stats">/api/stats</a> - 統計情報を取得
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/transactions">/api/transactions</a> - 取引履歴を取得
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/users">/api/users</a> - ユーザー一覧を取得
        </div>
        
        <h3>設定・データ管理</h3>
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/settings">/api/settings</a> - 現在の設定を取得
        </div>
        
        <div class="endpoint">
          <span class="method post">POST</span> /api/settings - 設定を更新
        </div>
        
        <div class="endpoint">
          <span class="method get">GET</span> <a href="/api/backup">/api/backup</a> - データバックアップを取得
        </div>
        
        <div class="endpoint">
          <span class="method post">POST</span> /api/restore - データを復元
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
        
        <h2>Discord Bot コマンド:</h2>
        <ul>
          <li><strong>!show</strong> - 商品一覧を表示</li>
          <li><strong>!buy [ID] [数量]</strong> - 商品を購入</li>
          <li><strong>!help</strong> - コマンド一覧を表示</li>
        </ul>
        
        <h3>管理者コマンド:</h3>
        <ul>
          <li><strong>!setprice [ID] [価格]</strong> - 商品の価格を変更</li>
          <li><strong>!setstock [ID] [数量]</strong> - 商品の在庫を変更</li>
          <li><strong>!additem [名前] [価格] [在庫] [説明]</strong> - 新しい商品を追加</li>
          <li><strong>!deleteitem [ID]</strong> - 商品を削除</li>
          <li><strong>!setdesc [ID] [説明]</strong> - 商品の説明を変更</li>
          <li><strong>!setmessage [タイプ] [メッセージ]</strong> - DMメッセージを設定</li>
          <li><strong>!backup</strong> - データバックアップをDMに送信</li>
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

# 設定を更新
curl -X POST https://discordvendorbot.onrender.com/api/settings \\
  -H "Content-Type: application/json" \\
  -d '{"purchaseSuccess": "カスタム購入完了メッセージ", "lowStockNotification": "カスタム在庫不足メッセージ"}'
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
    botStatus: token ? 'online' : 'offline',
    settings: {
      purchaseSuccessMessage,
      purchaseFailureMessage,
      lowStockNotificationMessage
    },
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

// Discordボットの機能実装
client.once(Events.ClientReady, (c) => {
  console.log(`Discord Bot準備完了！ログイン: ${c.user.tag}`);
});

// DMカスタムメッセージ用の設定
let purchaseSuccessMessage = '購入ありがとうございます！商品が購入されました。';
let purchaseFailureMessage = '申し訳ありません、購入処理中にエラーが発生しました。';
let lowStockNotificationMessage = '在庫が不足しています。管理者に連絡してください。';

// 商品テンプレート (DM送信用)
let itemTemplates = {
  premium: {
    title: 'プレミアムロール特典',
    description: 'サーバー内で特別な役割を付与されました。特典をお楽しみください！',
    color: 0x6562FA,
    footer: 'Discord Vending Bot - Premium'
  },
  emoji: {
    title: 'カスタム絵文字特典',
    description: 'あなただけのカスタム絵文字が追加されました。チャットでお使いいただけます！',
    color: 0x49cc90,
    footer: 'Discord Vending Bot - Custom Emoji'
  },
  channel: {
    title: 'プライベートチャネル特典',
    description: '特別なプライベートチャネルへのアクセス権が付与されました。',
    color: 0xff9966,
    footer: 'Discord Vending Bot - Private Channel'
  }
};

// メッセージ処理
client.on(Events.MessageCreate, async (message) => {
  // ボット自身のメッセージには反応しない
  if (message.author.bot) return;
  
  // スラッシュコマンドの処理
  if (message.content.startsWith('/')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    
    if (!command) return;
    
    // /help コマンド
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📜 コマンド一覧')
        .setColor(0x6562FA)
        .setDescription('以下のコマンドが使用できます：')
        .addFields(
          { name: '/help または !help', value: 'このヘルプを表示します' },
          { name: '/show または !show', value: '商品一覧を表示します' },
          { name: '/buy [ID] [数量] または !buy [ID] [数量]', value: '商品を購入します' }
        )
        .setFooter({ text: 'Discord Vending Bot' });
      
      // 管理者コマンドも表示
      if (message.member?.permissions.has('Administrator')) {
        embed.addFields(
          { name: '管理者コマンド', value: '以下は管理者のみ使用できるコマンドです：' },
          { name: '/setprice [ID] [価格] または !setprice [ID] [価格]', value: '商品の価格を変更します' },
          { name: '/setstock [ID] [数量] または !setstock [ID] [数量]', value: '商品の在庫を変更します' },
          { name: '/additem [名前] [価格] [在庫] [説明] または !additem ...', value: '新しい商品を追加します' },
          { name: '/deleteitem [ID] または !deleteitem [ID]', value: '商品を削除します' },
          { name: '/setdesc [ID] [説明] または !setdesc [ID] [説明]', value: '商品の説明を変更します' },
          { name: '/setmessage [タイプ] [メッセージ] または !setmessage ...', value: 'DMメッセージを変更します（タイプ: success, failure, lowstock）' },
          { name: '/backup または !backup', value: '現在のデータをバックアップします（DMに送信）' }
        );
      }
      
      await message.reply({ embeds: [embed] });
      return;
    }
    
    // その他のスラッシュコマンドは!コマンドと同じロジックで処理する
    // コマンド名をそのまま渡して処理させる
    await handleCommand(message, command, args, storage);
    return;
  }
  
  // !で始まるコマンド処理
  if (message.content.startsWith('!')) {
    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    // 商品一覧表示 (ボタン付き)
    if (command === 'show') {
      const embed = new EmbedBuilder()
        .setTitle('🎁 利用可能な商品')
        .setColor(0x6562FA)
        .setDescription('購入可能なアイテム一覧です。アイテムの「購入」ボタンをクリックするか、`!buy [ID] [数量]` コマンドで購入できます。')
        .setTimestamp();
        
      items.forEach(item => {
        embed.addFields({
          name: `${item.name} (ID: ${item.id})`,
          value: `${item.description}\n**価格**: ${item.price}コイン | **在庫**: ${item.stock}個`
        });
      });
      
      // アクションボタン用の行を作成
      const rows = [];
      
      // 5つごとにボタンをグループ化（1行に最大5つのボタンしか置けないため）
      for (let i = 0; i < items.length; i += 5) {
        const row = new ActionRowBuilder();
        const itemsInRow = items.slice(i, i + 5);
        
        itemsInRow.forEach(item => {
          // 在庫がある場合のみ購入ボタンを有効にする
          const isDisabled = item.stock <= 0;
          
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`buy_${item.id}`)
              .setLabel(`ID:${item.id} 購入`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(isDisabled)
          );
        });
        
        rows.push(row);
      }
      
      // すべてのボタン行を追加してメッセージを送信
      await message.reply({ 
        embeds: [embed],
        components: rows
      });
    }
    
    // ヘルプ表示
    else if (command === 'help') {
      const isAdmin = message.member?.permissions.has('Administrator');
      
      const embed = new EmbedBuilder()
        .setTitle('📜 コマンド一覧')
        .setColor(0x6562FA)
        .setDescription('以下のコマンドが使用できます：')
        .addFields(
          { name: '!show', value: '商品一覧を表示します' },
          { name: '!buy [ID] [数量]', value: '商品を購入します' }
        )
        .setFooter({ text: 'Discord Vending Bot' });
      
      // 管理者向けヘルプを追加
      if (isAdmin) {
        embed.addFields(
          { name: '管理者コマンド', value: '以下は管理者のみ使用できるコマンドです：' },
          { name: '!setprice [ID] [価格]', value: '商品の価格を変更します' },
          { name: '!setstock [ID] [数量]', value: '商品の在庫を変更します' },
          { name: '!additem [名前] [価格] [在庫] [説明]', value: '新しい商品を追加します' },
          { name: '!deleteitem [ID]', value: '商品を削除します' },
          { name: '!setdesc [ID] [説明]', value: '商品の説明を変更します' },
          { name: '!setmessage [タイプ] [メッセージ]', value: 'DMメッセージを変更します（タイプ: success, failure, lowstock）' },
          { name: '!backup', value: '現在のデータをバックアップします（DMに送信）' }
        );
      }
        
      await message.reply({ embeds: [embed] });
    }
    
    // 簡易購入処理
    else if (command === 'buy') {
      const itemId = parseInt(args[0]);
      const quantity = parseInt(args[1] || '1');
      
      if (isNaN(itemId)) {
        return message.reply('商品IDを指定してください。例: `!buy 1`');
      }
      
      const item = items.find(i => i.id === itemId);
      if (!item) {
        return message.reply(`ID: ${itemId} の商品は見つかりませんでした。`);
      }
      
      if (item.stock < quantity) {
        return message.reply(`在庫が不足しています。現在の在庫: ${item.stock}個`);
      }
      
      // 購入処理（シンプル版）
      item.stock -= quantity;
      
      // 購入記録
      const transaction = {
        id: transactions.length + 1,
        userId: message.author.id,
        itemId: item.id,
        quantity,
        amount: item.price * quantity,
        createdAt: new Date().toISOString()
      };
      
      transactions.push(transaction);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ 購入完了')
        .setColor(0x49cc90)
        .setDescription(`${item.name} を ${quantity}個 購入しました。`)
        .addFields(
          { name: '合計金額', value: `${item.price * quantity}コイン` },
          { name: '残り在庫', value: `${item.stock}個` }
        );
        
      await message.reply({ embeds: [embed] });
      
      // 商品種別に応じたテンプレートを選択
      let template = itemTemplates.premium; // デフォルト
      
      // 商品名に基づいて適切なテンプレートを選択
      if (item.name.includes('プレミアム') || item.name.includes('ロール')) {
        template = itemTemplates.premium;
      } else if (item.name.includes('絵文字') || item.name.includes('emoji')) {
        template = itemTemplates.emoji;
      } else if (item.name.includes('チャネル') || item.name.includes('channel')) {
        template = itemTemplates.channel;
      }
      
      // 購入確認のDMを送信
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle(template.title || '🛒 購入確認')
          .setColor(template.color || 0x49cc90)
          .setDescription(purchaseSuccessMessage)
          .addFields(
            { name: '商品', value: item.name },
            { name: '数量', value: quantity.toString() },
            { name: '価格', value: `${item.price}コイン/個` },
            { name: '合計', value: `${transaction.amount}コイン` },
            { name: '購入日時', value: new Date().toLocaleString('ja-JP') }
          )
          .setFooter({ text: template.footer || 'Discord Vending Bot' });
          
        await message.author.send({ embeds: [dmEmbed] });
      } catch (error) {
        console.error('DMの送信に失敗しました:', error);
      }
    }
    
    // 管理者コマンド: 価格変更
    else if (command === 'setprice' && message.member?.permissions.has('Administrator')) {
      const itemId = parseInt(args[0]);
      const newPrice = parseInt(args[1]);
      
      if (isNaN(itemId) || isNaN(newPrice)) {
        return message.reply('商品IDと新しい価格を指定してください。例: `!setprice 1 500`');
      }
      
      const item = items.find(i => i.id === itemId);
      if (!item) {
        return message.reply(`ID: ${itemId} の商品は見つかりませんでした。`);
      }
      
      const oldPrice = item.price;
      item.price = newPrice;
      
      await message.reply(`商品「${item.name}」の価格を ${oldPrice} → ${newPrice} コインに変更しました。`);
    }
    
    // 管理者コマンド: 在庫変更
    else if (command === 'setstock' && message.member?.permissions.has('Administrator')) {
      const itemId = parseInt(args[0]);
      const newStock = parseInt(args[1]);
      
      if (isNaN(itemId) || isNaN(newStock)) {
        return message.reply('商品IDと新しい在庫数を指定してください。例: `!setstock 1 100`');
      }
      
      const item = items.find(i => i.id === itemId);
      if (!item) {
        return message.reply(`ID: ${itemId} の商品は見つかりませんでした。`);
      }
      
      const oldStock = item.stock;
      item.stock = newStock;
      
      await message.reply(`商品「${item.name}」の在庫を ${oldStock} → ${newStock} 個に変更しました。`);
    }
    
    // 管理者コマンド: 商品追加
    else if (command === 'additem' && message.member?.permissions.has('Administrator')) {
      // !additem 商品名 価格 在庫数 説明
      if (args.length < 4) {
        return message.reply('商品名、価格、在庫数、説明を指定してください。例: `!additem プレミアムロール 1000 50 特別な役割を付与します`');
      }
      
      const name = args[0];
      const price = parseInt(args[1]);
      const stock = parseInt(args[2]);
      const description = args.slice(3).join(' ');
      
      if (isNaN(price) || isNaN(stock)) {
        return message.reply('価格と在庫数は数値で指定してください。');
      }
      
      const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      
      const newItem = {
        id: newId,
        name,
        description,
        price,
        stock
      };
      
      items.push(newItem);
      
      const embed = new EmbedBuilder()
        .setTitle('✅ 商品追加完了')
        .setColor(0x49cc90)
        .setDescription(`新しい商品「${name}」を追加しました。`)
        .addFields(
          { name: 'ID', value: newId.toString() },
          { name: '価格', value: `${price}コイン` },
          { name: '在庫', value: `${stock}個` },
          { name: '説明', value: description }
        );
        
      await message.reply({ embeds: [embed] });
    }
    
    // 管理者コマンド: DM設定変更
    else if (command === 'setmessage' && message.member?.permissions.has('Administrator')) {
      // !setmessage success/failure/lowstock メッセージ内容
      if (args.length < 2) {
        return message.reply('メッセージタイプとメッセージ内容を指定してください。例: `!setmessage success ご購入ありがとうございます！`');
      }
      
      const messageType = args[0].toLowerCase();
      const messageContent = args.slice(1).join(' ');
      
      if (messageType === 'success') {
        purchaseSuccessMessage = messageContent;
        await message.reply('購入成功時のメッセージを更新しました。');
      } else if (messageType === 'failure') {
        purchaseFailureMessage = messageContent;
        await message.reply('購入失敗時のメッセージを更新しました。');
      } else if (messageType === 'lowstock') {
        lowStockNotificationMessage = messageContent;
        await message.reply('在庫不足時のメッセージを更新しました。');
      } else {
        await message.reply('有効なメッセージタイプは success, failure, lowstock です。');
      }
    }
    
    // 管理者コマンド: 商品削除
    else if (command === 'deleteitem' && message.member?.permissions.has('Administrator')) {
      const itemId = parseInt(args[0]);
      
      if (isNaN(itemId)) {
        return message.reply('削除する商品のIDを指定してください。例: `!deleteitem 1`');
      }
      
      const itemIndex = items.findIndex(i => i.id === itemId);
      if (itemIndex === -1) {
        return message.reply(`ID: ${itemId} の商品は見つかりませんでした。`);
      }
      
      const deletedItem = items[itemIndex];
      items.splice(itemIndex, 1);
      
      await message.reply(`商品「${deletedItem.name}」を削除しました。`);
    }
    
    // 管理者コマンド: 商品説明変更
    else if (command === 'setdesc' && message.member?.permissions.has('Administrator')) {
      // !setdesc 1 新しい説明文
      if (args.length < 2) {
        return message.reply('商品IDと新しい説明文を指定してください。例: `!setdesc 1 新しい商品の説明文`');
      }
      
      const itemId = parseInt(args[0]);
      const newDescription = args.slice(1).join(' ');
      
      if (isNaN(itemId)) {
        return message.reply('有効な商品IDを指定してください。');
      }
      
      const item = items.find(i => i.id === itemId);
      if (!item) {
        return message.reply(`ID: ${itemId} の商品は見つかりませんでした。`);
      }
      
      const oldDescription = item.description;
      item.description = newDescription;
      
      await message.reply(`商品「${item.name}」の説明を更新しました。`);
    }
    
    // 管理者コマンド: データバックアップ
    else if (command === 'backup' && message.member?.permissions.has('Administrator')) {
      const data = {
        items,
        transactions,
        users,
        timestamp: new Date().toISOString()
      };
      
      const jsonData = JSON.stringify(data, null, 2);
      
      // DMでバックアップデータを送信
      try {
        await message.author.send({
          content: `📊 データバックアップ (${new Date().toLocaleString('ja-JP')})`,
          files: [{
            attachment: Buffer.from(jsonData),
            name: `discord-bot-backup-${new Date().toISOString().slice(0, 10)}.json`
          }]
        });
        
        await message.reply('バックアップデータをDMに送信しました。');
      } catch (error) {
        console.error('バックアップの送信に失敗しました:', error);
        await message.reply('バックアップデータの送信に失敗しました。DMが開けることを確認してください。');
      }
    }
  }
});

// Discordボットのトークンが設定されている場合、ボットをログイン
const token = process.env.DISCORD_BOT_TOKEN;
console.log('環境変数の確認: DISCORD_BOT_TOKEN ' + (token ? '設定済み' : '未設定'));

if (token) {
  try {
    console.log('Discordボットのログイン処理を開始します...');
    client.login(token)
      .then(() => console.log('Discordボットが正常にログインしました'))
      .catch(err => {
        console.error('Discordボットのログインに失敗しました:', err);
        console.error('トークンが正しいか確認してください');
      });
  } catch (error) {
    console.error('ボットログイン処理中に例外が発生しました:', error);
  }
} else {
  console.warn('DISCORD_BOT_TOKEN が設定されていません。Discordボット機能は無効です。');
  console.warn('Renderダッシュボードで環境変数を設定してください。');
}

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが起動しました: ポート ${PORT}`);
});