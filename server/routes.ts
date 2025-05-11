import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { initBot } from "./discord/bot";
import { insertItemSchema, insertBotSettingsSchema } from "@shared/schema";

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

  const httpServer = createServer(app);

  return httpServer;
}
