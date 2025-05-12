import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { initBot } from "./discord/bot";
import { insertItemSchema, insertBotSettingsSchema, insertTransactionSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Discord bot
  const bot = initBot();
  
  // API endpoints
  app.get('/api/items', async (_req, res) => {
    try {
      const items = await storage.getItems();
      res.json(items);
    } catch (error) {
      console.error('Error fetching items:', error);
      res.status(500).json({ message: 'Failed to fetch items' });
    }
  });
  
  app.get('/api/items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }
      
      const item = await storage.getItem(id);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }
      
      res.json(item);
    } catch (error) {
      console.error('Error fetching item:', error);
      res.status(500).json({ message: 'Failed to fetch item' });
    }
  });
  
  app.post('/api/items', async (req, res) => {
    try {
      const validatedData = insertItemSchema.parse(req.body);
      const item = await storage.createItem(validatedData);
      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid item data', errors: error.errors });
      }
      
      console.error('Error creating item:', error);
      res.status(500).json({ message: 'Failed to create item' });
    }
  });
  
  app.patch('/api/items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }
      
      // Partial validation of the update data
      const validatedData = insertItemSchema.partial().parse(req.body);
      
      const item = await storage.updateItem(id, validatedData);
      if (!item) {
        return res.status(404).json({ message: 'Item not found' });
      }
      
      res.json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid item data', errors: error.errors });
      }
      
      console.error('Error updating item:', error);
      res.status(500).json({ message: 'Failed to update item' });
    }
  });
  
  app.delete('/api/items/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid item ID' });
      }
      
      const deleted = await storage.deleteItem(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Item not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting item:', error);
      res.status(500).json({ message: 'Failed to delete item' });
    }
  });
  
  app.get('/api/discord-users', async (_req, res) => {
    try {
      const users = await storage.getDiscordUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching discord users:', error);
      res.status(500).json({ message: 'Failed to fetch discord users' });
    }
  });
  
  app.post('/api/discord-users/reset-balances', async (_req, res) => {
    try {
      const resetCount = await storage.resetAllDiscordUserBalances();
      res.json({ 
        success: true, 
        message: `${resetCount} Discord ユーザーの残高をゼロにリセットしました`,
        resetCount
      });
    } catch (error) {
      console.error('Error resetting discord user balances:', error);
      res.status(500).json({ message: 'Discord ユーザーの残高リセットに失敗しました' });
    }
  });
  
  // 特定のユーザーにコインを付与するエンドポイント
  app.post('/api/discord-users/add-coins', async (req, res) => {
    try {
      // リクエストのバリデーション
      const addCoinsSchema = z.object({
        discordId: z.string(),
        amount: z.number().int().positive()
      });
      
      const { discordId, amount } = addCoinsSchema.parse(req.body);
      
      // ユーザーを検索
      let discordUser = await storage.getDiscordUserByDiscordId(discordId);
      
      if (!discordUser) {
        // ユーザーが存在しない場合は作成
        discordUser = await storage.createDiscordUser({
          discordId,
          username: `User-${discordId.slice(-5)}`,
          balance: 0
        });
      }
      
      // 残高を更新
      const updatedUser = await storage.updateDiscordUserBalance(discordUser.id, amount);
      
      if (!updatedUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'ユーザーが見つかりません' 
        });
      }
      
      res.json({
        success: true,
        message: `ユーザーID: ${discordId} に ${amount} コインを追加しました`,
        user: updatedUser
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: 'リクエストデータが無効です', 
          errors: error.errors 
        });
      }
      
      console.error('Error adding coins to user:', error);
      res.status(500).json({ 
        success: false,
        message: 'コインの追加に失敗しました' 
      });
    }
  });
  
  // 特定のユーザーの残高を設定するエンドポイント
  app.post('/api/discord-users/set-balance', async (req, res) => {
    try {
      // リクエストのバリデーション
      const setBalanceSchema = z.object({
        discordId: z.string(),
        balance: z.number().int().nonnegative()
      });
      
      const { discordId, balance } = setBalanceSchema.parse(req.body);
      
      // ユーザーを検索
      let discordUser = await storage.getDiscordUserByDiscordId(discordId);
      
      if (!discordUser) {
        // ユーザーが存在しない場合は作成
        discordUser = await storage.createDiscordUser({
          discordId,
          username: `User-${discordId.slice(-5)}`,
          balance: 0
        });
      }
      
      // 残高を設定
      const updatedUser = await storage.setDiscordUserBalance(discordUser.id, balance);
      
      if (!updatedUser) {
        return res.status(404).json({ 
          success: false, 
          message: 'ユーザーが見つかりません' 
        });
      }
      
      res.json({
        success: true,
        message: `ユーザーID: ${discordId} の残高を ${balance} コインに設定しました`,
        user: updatedUser
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false,
          message: 'リクエストデータが無効です', 
          errors: error.errors 
        });
      }
      
      console.error('Error setting user balance:', error);
      res.status(500).json({ 
        success: false,
        message: '残高の設定に失敗しました' 
      });
    }
  });
  
  app.get('/api/transactions', async (_req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });
  
  app.get('/api/stats', async (_req, res) => {
    try {
      const items = await storage.getItems();
      const transactions = await storage.getTransactions();
      const discordUsers = await storage.getDiscordUsers();
      
      // Calculate stats
      const totalSales = transactions.length;
      const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalPrice, 0);
      const totalStock = items.reduce((sum, item) => sum + item.stock, 0);
      const lowStockItems = items.filter(item => item.stock > 0 && item.stock < 5).length;
      const userCount = discordUsers.length;
      const newUsers = discordUsers.filter(user => {
        const createdDate = new Date(user.createdAt);
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        return createdDate > oneWeekAgo;
      }).length;
      
      // Weekly growth calculation
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const thisWeekSales = transactions.filter(tx => new Date(tx.createdAt) > oneWeekAgo).length;
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      const lastWeekSales = transactions.filter(tx => {
        const date = new Date(tx.createdAt);
        return date > twoWeeksAgo && date <= oneWeekAgo;
      }).length;
      
      const salesGrowth = lastWeekSales > 0 
        ? Math.round((thisWeekSales - lastWeekSales) / lastWeekSales * 100) 
        : 0;
      
      res.json({
        totalSales,
        totalRevenue,
        totalStock,
        lowStockItems,
        userCount,
        newUsers,
        salesGrowth
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });
  
  app.get('/api/bot-settings/:guildId', async (req, res) => {
    try {
      const guildId = req.params.guildId;
      const settings = await storage.getBotSettings(guildId);
      
      if (!settings) {
        return res.status(404).json({ message: 'Bot settings not found' });
      }
      
      res.json(settings);
    } catch (error) {
      console.error('Error fetching bot settings:', error);
      res.status(500).json({ message: 'Failed to fetch bot settings' });
    }
  });
  
  app.post('/api/bot-settings', async (req, res) => {
    try {
      const validatedData = insertBotSettingsSchema.parse(req.body);
      const settings = await storage.createBotSettings(validatedData);
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bot settings data', errors: error.errors });
      }
      
      console.error('Error creating bot settings:', error);
      res.status(500).json({ message: 'Failed to create bot settings' });
    }
  });
  
  app.patch('/api/bot-settings/:guildId', async (req, res) => {
    try {
      const guildId = req.params.guildId;
      
      // Partial validation of the update data
      const validatedData = insertBotSettingsSchema.partial().parse(req.body);
      
      const settings = await storage.updateBotSettings(guildId, validatedData);
      if (!settings) {
        return res.status(404).json({ message: 'Bot settings not found' });
      }
      
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid bot settings data', errors: error.errors });
      }
      
      console.error('Error updating bot settings:', error);
      res.status(500).json({ message: 'Failed to update bot settings' });
    }
  });
  
  // 購入処理API
  app.post('/api/purchase', async (req, res) => {
    try {
      // リクエストのバリデーション
      const purchaseSchema = z.object({
        discordId: z.string(),
        items: z.array(z.object({
          itemId: z.number(),
          quantity: z.number().min(1)
        }))
      });
      
      const { discordId, items } = purchaseSchema.parse(req.body);
      
      // Discordユーザーを取得または作成
      let discordUser = await storage.getDiscordUserByDiscordId(discordId);
      
      if (!discordUser) {
        // Discordユーザーが存在しない場合は新規作成
        discordUser = await storage.createDiscordUser({
          discordId,
          username: `User-${discordId.slice(-5)}`, // 実際のユーザー名は取得できないのでIDの末尾5桁を使用
          balance: 0 // 初期残高
        });
      }
      
      // 各商品の取得と在庫・価格の検証
      const purchaseItems = [];
      let totalPrice = 0;
      
      for (const item of items) {
        const productItem = await storage.getItem(item.itemId);
        
        if (!productItem) {
          return res.status(404).json({ 
            message: `Item with ID ${item.itemId} not found` 
          });
        }
        
        if (!productItem.isActive) {
          return res.status(400).json({ 
            message: `Item ${productItem.name} is currently not available for purchase`
          });
        }
        
        if (productItem.stock < item.quantity) {
          return res.status(400).json({ 
            message: `Not enough stock for ${productItem.name}. Available: ${productItem.stock}`
          });
        }
        
        const itemTotal = productItem.price * item.quantity;
        totalPrice += itemTotal;
        
        purchaseItems.push({
          item: productItem,
          quantity: item.quantity,
          itemTotal
        });
      }
      
      // 残高チェック
      if (discordUser.balance < totalPrice) {
        return res.status(400).json({ 
          message: `Insufficient balance. Required: ${totalPrice}, Available: ${discordUser.balance}`
        });
      }
      
      // トランザクション作成と在庫・残高の更新
      const transactions = [];
      
      for (const purchaseItem of purchaseItems) {
        // 在庫の更新
        await storage.updateItem(purchaseItem.item.id, {
          stock: purchaseItem.item.stock - purchaseItem.quantity
        });
        
        // トランザクション作成
        const transaction = await storage.createTransaction({
          discordUserId: discordUser.id,
          itemId: purchaseItem.item.id,
          quantity: purchaseItem.quantity,
          totalPrice: purchaseItem.itemTotal
        });
        
        transactions.push(transaction);
      }
      
      // 残高の更新
      await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
      
      // 更新されたユーザー情報を取得
      const updatedUser = await storage.getDiscordUser(discordUser.id);
      
      res.status(201).json({
        success: true,
        transactions,
        user: updatedUser,
        totalPrice
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid purchase data', 
          errors: error.errors 
        });
      }
      
      console.error('Error processing purchase:', error);
      res.status(500).json({ message: 'Failed to process purchase' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
