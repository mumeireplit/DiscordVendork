import { 
  users, type User, type InsertUser,
  items, type Item, type InsertItem,
  discordUsers, type DiscordUser, type InsertDiscordUser,
  transactions, type Transaction, type InsertTransaction,
  botSettings, type BotSettings, type InsertBotSettings
} from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Item methods
  getItems(): Promise<Item[]>;
  getItem(id: number): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: number, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: number): Promise<boolean>;
  
  // Discord user methods
  getDiscordUsers(): Promise<DiscordUser[]>;
  getDiscordUser(id: number): Promise<DiscordUser | undefined>;
  getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined>;
  createDiscordUser(discordUser: InsertDiscordUser): Promise<DiscordUser>;
  updateDiscordUserBalance(id: number, amount: number): Promise<DiscordUser | undefined>;
  setDiscordUserBalance(id: number, balance: number): Promise<DiscordUser | undefined>;
  resetAllDiscordUserBalances(): Promise<number>; // Returns the number of users reset
  
  // Transaction methods
  getTransactions(): Promise<Transaction[]>;
  getTransactionsByDiscordUser(discordUserId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  // Bot settings methods
  getBotSettings(guildId: string): Promise<BotSettings | undefined>;
  createBotSettings(settings: InsertBotSettings): Promise<BotSettings>;
  updateBotSettings(guildId: string, settings: Partial<InsertBotSettings>): Promise<BotSettings | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private items: Map<number, Item>;
  private discordUsers: Map<number, DiscordUser>;
  private transactions: Map<number, Transaction>;
  private botSettings: Map<string, BotSettings>;
  
  private userIdCounter: number;
  private itemIdCounter: number;
  private discordUserIdCounter: number;
  private transactionIdCounter: number;
  private botSettingsIdCounter: number;

  constructor() {
    this.users = new Map();
    this.items = new Map();
    this.discordUsers = new Map();
    this.transactions = new Map();
    this.botSettings = new Map();
    
    this.userIdCounter = 1;
    this.itemIdCounter = 1;
    this.discordUserIdCounter = 1;
    this.transactionIdCounter = 1;
    this.botSettingsIdCounter = 1;
    
    // Add some sample items
    this.createItem({
      name: "プレミアムロール",
      description: "サーバー内で特別な役割を付与します",
      price: 500,
      stock: 100,
      isActive: true,
      discordRoleId: "123456789"
    });
    
    this.createItem({
      name: "特別チャンネルアクセス",
      description: "限定チャンネルにアクセスできるようになります",
      price: 1000,
      stock: 50,
      isActive: true,
      discordRoleId: "987654321"
    });
    
    this.createItem({
      name: "カスタム絵文字",
      description: "オリジナルの絵文字を追加できます",
      price: 750,
      stock: 5,
      isActive: true,
      discordRoleId: null
    });
    
    this.createItem({
      name: "VIPステータス (7日間)",
      description: "7日間のVIPステータスを付与します",
      price: 2000,
      stock: 0,
      isActive: true,
      discordRoleId: "456789123"
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Item methods
  async getItems(): Promise<Item[]> {
    return Array.from(this.items.values());
  }
  
  async getItem(id: number): Promise<Item | undefined> {
    return this.items.get(id);
  }
  
  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = this.itemIdCounter++;
    const createdAt = new Date();
    // Ensure all required fields have values
    const item: Item = { 
      ...insertItem, 
      id, 
      createdAt,
      price: insertItem.price || 0,
      stock: insertItem.stock || 0,
      isActive: insertItem.isActive !== undefined ? insertItem.isActive : true,
      infiniteStock: insertItem.infiniteStock !== undefined ? insertItem.infiniteStock : false,
      discordRoleId: insertItem.discordRoleId || null
    };
    this.items.set(id, item);
    return item;
  }
  
  async updateItem(id: number, itemUpdate: Partial<InsertItem>): Promise<Item | undefined> {
    const item = await this.getItem(id);
    if (!item) return undefined;
    
    const updatedItem: Item = {
      ...item,
      ...itemUpdate
    };
    
    this.items.set(id, updatedItem);
    return updatedItem;
  }
  
  async deleteItem(id: number): Promise<boolean> {
    return this.items.delete(id);
  }
  
  // Discord user methods
  async getDiscordUsers(): Promise<DiscordUser[]> {
    return Array.from(this.discordUsers.values());
  }
  
  async getDiscordUser(id: number): Promise<DiscordUser | undefined> {
    return this.discordUsers.get(id);
  }
  
  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    return Array.from(this.discordUsers.values()).find(
      (user) => user.discordId === discordId,
    );
  }
  
  async createDiscordUser(insertDiscordUser: InsertDiscordUser): Promise<DiscordUser> {
    const id = this.discordUserIdCounter++;
    const createdAt = new Date();
    const discordUser: DiscordUser = { 
      ...insertDiscordUser, 
      id, 
      createdAt,
      balance: insertDiscordUser.balance !== undefined ? insertDiscordUser.balance : 0 
    };
    this.discordUsers.set(id, discordUser);
    return discordUser;
  }
  
  async updateDiscordUserBalance(id: number, amount: number): Promise<DiscordUser | undefined> {
    const discordUser = await this.getDiscordUser(id);
    if (!discordUser) return undefined;
    
    const updatedDiscordUser: DiscordUser = {
      ...discordUser,
      balance: discordUser.balance + amount
    };
    
    this.discordUsers.set(id, updatedDiscordUser);
    return updatedDiscordUser;
  }
  
  async setDiscordUserBalance(id: number, balance: number): Promise<DiscordUser | undefined> {
    const discordUser = await this.getDiscordUser(id);
    if (!discordUser) return undefined;
    
    const updatedDiscordUser: DiscordUser = {
      ...discordUser,
      balance: balance
    };
    
    this.discordUsers.set(id, updatedDiscordUser);
    return updatedDiscordUser;
  }
  
  async resetAllDiscordUserBalances(): Promise<number> {
    let count = 0;
    const users = await this.getDiscordUsers();
    
    for (const user of users) {
      await this.setDiscordUserBalance(user.id, 0);
      count++;
    }
    
    return count;
  }
  
  // Transaction methods
  async getTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }
  
  async getTransactionsByDiscordUser(discordUserId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values()).filter(
      (transaction) => transaction.discordUserId === discordUserId,
    );
  }
  
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const createdAt = new Date();
    const transaction: Transaction = { ...insertTransaction, id, createdAt };
    this.transactions.set(id, transaction);
    return transaction;
  }
  
  // Bot settings methods
  async getBotSettings(guildId: string): Promise<BotSettings | undefined> {
    return this.botSettings.get(guildId);
  }
  
  async createBotSettings(insertSettings: InsertBotSettings): Promise<BotSettings> {
    const id = this.botSettingsIdCounter++;
    const settings: BotSettings = { ...insertSettings, id };
    this.botSettings.set(insertSettings.guildId, settings);
    return settings;
  }
  
  async updateBotSettings(guildId: string, settingsUpdate: Partial<InsertBotSettings>): Promise<BotSettings | undefined> {
    const settings = await this.getBotSettings(guildId);
    if (!settings) return undefined;
    
    const updatedSettings: BotSettings = {
      ...settings,
      ...settingsUpdate
    };
    
    this.botSettings.set(guildId, updatedSettings);
    return updatedSettings;
  }
}

export const storage = new MemStorage();
