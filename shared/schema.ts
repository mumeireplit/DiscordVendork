import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user table from the template
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Items in the vending machine
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  infiniteStock: boolean("infinite_stock").notNull().default(false),
  discordRoleId: text("discord_role_id"),
  content: text("content"), // URLや購入後にDMで送信するコンテンツ
  options: text("options").array(), // 商品の選択肢（例：色、サイズ、種類など）
  createdAt: timestamp("created_at").defaultNow(),
});

// Discord users with balances
export const discordUsers = pgTable("discord_users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  balance: integer("balance").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Transactions for purchases
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  discordUserId: integer("discord_user_id").notNull(),
  itemId: integer("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  totalPrice: integer("total_price").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings for the bot
export const botSettings = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  currencyName: text("currency_name").notNull().default("コイン"),
  prefix: text("prefix").notNull().default("/vending"),
  isActive: boolean("is_active").notNull().default(true),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertItemSchema = createInsertSchema(items).pick({
  name: true,
  description: true,
  price: true,
  stock: true,
  isActive: true,
  infiniteStock: true,
  discordRoleId: true,
  content: true,
  options: true,
});

export const insertDiscordUserSchema = createInsertSchema(discordUsers).pick({
  discordId: true,
  username: true,
  balance: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  discordUserId: true,
  itemId: true,
  quantity: true,
  totalPrice: true,
});

export const insertBotSettingsSchema = createInsertSchema(botSettings).pick({
  guildId: true,
  currencyName: true,
  prefix: true,
  isActive: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type DiscordUser = typeof discordUsers.$inferSelect;
export type InsertDiscordUser = z.infer<typeof insertDiscordUserSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type BotSettings = typeof botSettings.$inferSelect;
export type InsertBotSettings = z.infer<typeof insertBotSettingsSchema>;
