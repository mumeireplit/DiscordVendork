import { Client, SlashCommandBuilder, EmbedBuilder, CommandInteraction, REST, Routes, Collection, Message, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { client } from './bot';
import { IStorage } from '../storage';
import { Item } from '@shared/schema';
import { storage } from '../index'; // インポート元をindex.tsに変更

// Discord内で使用するユーザーごとのカートを管理
interface CartItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface UserCart {
  userId: string;
  items: CartItem[];
  lastUpdated: Date;
}

// メモリ内にカート情報を保持（再起動で消去）
const userCarts = new Map<string, UserCart>();

// カート関連のユーティリティ関数
function getUserCart(userId: string): UserCart {
  if (!userCarts.has(userId)) {
    userCarts.set(userId, {
      userId,
      items: [],
      lastUpdated: new Date()
    });
  }
  return userCarts.get(userId)!;
}

function addToCart(userId: string, item: Item, quantity: number = 1): UserCart {
  const cart = getUserCart(userId);
  const existingItem = cart.items.find(i => i.itemId === item.id);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: quantity
    });
  }
  
  cart.lastUpdated = new Date();
  return cart;
}

function removeFromCart(userId: string, itemId: number, quantity: number = 1): UserCart {
  const cart = getUserCart(userId);
  const existingItemIndex = cart.items.findIndex(i => i.itemId === itemId);
  
  if (existingItemIndex !== -1) {
    const item = cart.items[existingItemIndex];
    
    if (item.quantity <= quantity) {
      // 数量がゼロ以下になる場合は商品自体を削除
      cart.items.splice(existingItemIndex, 1);
    } else {
      // そうでない場合は数量を減らす
      item.quantity -= quantity;
    }
  }
  
  cart.lastUpdated = new Date();
  return cart;
}

function clearCart(userId: string): void {
  userCarts.delete(userId);
}

function getCartTotal(userId: string): number {
  const cart = getUserCart(userId);
  return cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Extend Discord.js Client to add commands property
interface BotClient extends Client {
  commands: Collection<string, any>;
}

// Handle message commands with ! prefix
export async function handleCommand(message: Message, commandName: string, args: string[], storage: IStorage) {
  try {
    // Map commandName to the appropriate command function
    switch(commandName) {
      case 'show':
        await handleShowCommand(message, storage);
        break;
      case 'buy':
        await handleBuyCommand(message, args, storage);
        break;
      case 'cart':
        await handleCartCommand(message, args, storage);
        break;
      case 'checkout':
        await handleCheckoutCommand(message, storage);
        break;
      case 'balance':
        await handleBalanceCommand(message, storage);
        break;
      case 'add':
        await handleAddCommand(message, args, storage);
        break;
      case 'remove':
        await handleRemoveCommand(message, args, storage);
        break;
      case 'price':
        await handlePriceCommand(message, args, storage);
        break;
      case 'stock':
        await handleStockCommand(message, args, storage);
        break;
      case 'help':
        await handleHelpCommand(message);
        break;
      case 'addcoins':
        await handleAddCoinsCommand(message, args, storage);
        break;
      default:
        await message.reply('無効なコマンドです。利用可能なコマンド一覧は `!help` で確認できます。');
        break;
    }
  } catch (error) {
    console.error('Error handling command:', error);
    await message.reply('コマンドの実行中にエラーが発生しました。');
  }
}

// Show command for ! prefix
async function handleShowCommand(message: Message, storage: IStorage) {
  try {
    const items = await storage.getItems();
    const activeItems = items.filter(item => item.isActive);
    
    // Get bot settings or use defaults
    const guildSettings = await storage.getBotSettings(message.guildId || '');
    const currencyName = guildSettings?.currencyName || 'コイン';
    
    // ユーザー残高を取得
    const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    const balance = discordUser ? discordUser.balance : 0;
    
    // Create embed for the vending machine
    const embed = new EmbedBuilder()
      .setTitle('🎰 じはんき - 商品一覧')
      .setDescription('以下の商品が販売中です。ボタンをクリックして購入できます。購入後、DMにて商品内容が送信されます。')
      .setColor('#5865F2');

    // 商品がない場合
    if (activeItems.length === 0) {
      embed.setDescription('現在販売中の商品はありません。');
      return await message.reply({ embeds: [embed] });
    }
    
    // 商品ごとにボタンコンポーネントを作成
    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    const PAGE_SIZE = 5; // 1ページあたりの商品数
    
    // ページング処理（最大25個のボタンまで表示可能なので、5行×5列の形式）
    for (let i = 0; i < Math.min(activeItems.length, PAGE_SIZE); i++) {
      const item = activeItems[i];
      
      // 商品情報をEmbedに追加
      const stockStatus = item.stock > 0 
        ? `在庫: ${item.stock}`
        : '在庫切れ';

      // DMへのコンテンツがある場合はアイコンを表示
      const hasContent = item.content || (item.contentOptions && item.contentOptions.length > 0);
      const contentIcon = hasContent ? '📨 ' : '';
      
      embed.addFields({
        name: `${contentIcon}#${item.id.toString().padStart(3, '0')} ${item.name}`,
        value: `${item.description}\n価格: **${item.price} ${currencyName}** | ${stockStatus}${hasContent ? '\n購入後DMで内容が届きます！' : ''}`,
        inline: false
      });
      
      // 商品のボタンを作成
      const row = new ActionRowBuilder<ButtonBuilder>();
      
      // 直接購入ボタン
      const buyButton = new ButtonBuilder()
        .setCustomId(`buy_${item.id}_1`) // アイテムIDと数量=1を含める
        .setLabel(`購入する (${item.price} ${currencyName})`)
        .setStyle(ButtonStyle.Success)
        .setDisabled(item.stock <= 0 || balance < item.price);
      
      // カートに追加ボタン
      const addToCartButton = new ButtonBuilder()
        .setCustomId(`cart_add_${item.id}_1`)
        .setLabel('カートに追加')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(item.stock <= 0);
      
      // 詳細表示ボタン
      const detailsButton = new ButtonBuilder()
        .setCustomId(`details_${item.id}`)
        .setLabel('詳細')
        .setStyle(ButtonStyle.Secondary);
      
      // コンテンツ選択肢がある場合は選択ボタンを追加
      if (item.contentOptions && item.contentOptions.length > 0) {
        const previewButton = new ButtonBuilder()
          .setCustomId(`preview_${item.id}`)
          .setLabel('選択肢を見る')
          .setStyle(ButtonStyle.Secondary);
        
        row.addComponents(buyButton, addToCartButton, detailsButton, previewButton);
      } else {
        row.addComponents(buyButton, addToCartButton, detailsButton);
      }
      
      components.push(row);
    }
    
    // ナビゲーションボタン
    if (activeItems.length > PAGE_SIZE) {
      const navRow = new ActionRowBuilder<ButtonBuilder>();
      
      const nextPageButton = new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('次のページ ▶')
        .setStyle(ButtonStyle.Secondary);
      
      const showAllButton = new ButtonBuilder()
        .setCustomId('show_all')
        .setLabel('すべての商品を見る')
        .setStyle(ButtonStyle.Secondary);
      
      const cartButton = new ButtonBuilder()
        .setCustomId('view_cart')
        .setLabel('カートを見る')
        .setStyle(ButtonStyle.Secondary);
      
      navRow.addComponents(nextPageButton, showAllButton, cartButton);
      components.push(navRow);
    }
    
    // フッターに残高を表示
    if (discordUser) {
      embed.setFooter({ 
        text: `残高: ${discordUser.balance} ${currencyName} | 購入するとDMで内容が届きます` 
      });
    }
    
    // メッセージを送信
    const sentMessage = await message.reply({ 
      embeds: [embed],
      components: components
    });
    
    // ボタンのインタラクションを処理するコレクターを設定
    const collector = sentMessage.createMessageComponentCollector({ 
      time: 300000 // 5分間有効
    });
    
    collector.on('collect', async (interaction) => {
      // ボタンを押したのが元のユーザーでない場合はエラー
      if (interaction.user.id !== message.author.id) {
        return await interaction.reply({ 
          content: 'この操作はメッセージの送信者のみ実行できます。`!show`コマンドで自分のリストを表示してください。', 
          flags: MessageFlags.Ephemeral
        });
      }
      
      const customId = interaction.customId;
      
      // ボタンのIDを解析して処理
      if (customId.startsWith('buy_')) {
        // 直接購入処理 - 確認なしで直接購入
        const [_, itemId, quantity] = customId.split('_').map(Number);
        
        // 商品情報を取得
        const item = activeItems.find(i => i.id === itemId);
        
        if (!item) {
          return await interaction.reply({
            content: '商品が見つかりません。',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // 処理中メッセージを表示
        await interaction.reply({
          content: `${item.name} ${quantity}個を購入処理中です...`,
          flags: MessageFlags.Ephemeral
        });
        
        try {
          // ユーザー情報を取得
          let discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
          
          if (!discordUser) {
            // ユーザーが存在しない場合は作成（初期残高0）
            discordUser = await storage.createDiscordUser({
              discordId: interaction.user.id,
              username: interaction.user.username,
              balance: 0 // 初期残高を0に設定
            });
          }
          
          const totalPrice = item.price * quantity;
          
          // 残高確認
          if (discordUser.balance < totalPrice) {
            return await interaction.editReply({
              content: `残高が不足しています。必要な金額: ${totalPrice} ${currencyName}、現在の残高: ${discordUser.balance} ${currencyName}`
            });
          }
          
          // 在庫確認
          const updatedItem = await storage.getItem(item.id);
          if (!updatedItem || (!updatedItem.infiniteStock && updatedItem.stock < quantity)) {
            return await interaction.editReply({
              content: `在庫が不足しています。現在の在庫: ${updatedItem ? updatedItem.stock : 0}`
            });
          }
          
          // 残高を減らす
          await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
          
          // 在庫を減らす（無限在庫でない場合）
          if (!updatedItem.infiniteStock) {
            await storage.updateItem(updatedItem.id, { 
              stock: updatedItem.stock - quantity 
            });
          }
          
          // トランザクションを記録
          await storage.createTransaction({
            discordUserId: discordUser.id,
            itemId: updatedItem.id,
            quantity: quantity,
            totalPrice: totalPrice
          });
          
          // ロールを付与（該当する場合）
          if (updatedItem.discordRoleId && interaction.guild) {
            try {
              const member = await interaction.guild.members.fetch(interaction.user.id);
              await member.roles.add(updatedItem.discordRoleId);
            } catch (roleError) {
              console.error('Error adding role:', roleError);
              // ロール付与エラーは無視して続行
            }
          }
          
          // 更新された残高を取得
          const updatedUser = await storage.getDiscordUser(discordUser.id);
          const newBalance = updatedUser ? updatedUser.balance : 0;
          
          // 成功メッセージを表示
          await interaction.editReply({
            content: `✅ ${updatedItem.name} を ${quantity} 個購入しました！\n残高: ${newBalance} ${currencyName}`
          });
          
          // 公開メッセージ
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛒 商品が購入されました！')
            .setDescription(`${interaction.user.username} が ${updatedItem.name} を ${quantity} 個購入しました！`)
            .setColor('#3BA55C')
            .setTimestamp();
          
          if (message.channel && typeof message.channel.send === 'function') {
            await message.channel.send({ embeds: [publicEmbed] });
          }
          
          // アイテムのコンテンツがある場合はDMで送信
          if (updatedItem.content) {
            try {
              // クライアントからユーザーを取得して、DMを送信
              const user = await client.users.fetch(interaction.user.id);
              await user.createDM().then(dm => 
                dm.send(`🎁 商品の詳細情報: ${updatedItem.name}\n\n${updatedItem.content}`)
              );
              
              console.log(`DMが正常に送信されました: ${interaction.user.username}`);
            } catch (dmError) {
              console.error('Error sending DM:', dmError);
              // DMが送れない場合は通知
              await interaction.followUp({
                content: `DM送信に失敗しました。プライバシー設定を確認してください。`,
                flags: MessageFlags.Ephemeral
              });
            }
          }
          
          // 選択肢がある場合、選択用のメッセージをDMで送信
          if (updatedItem.contentOptions && updatedItem.contentOptions.length > 0) {
            try {
              const user = await client.users.fetch(interaction.user.id);
              const dm = await user.createDM();
              
              // 選択肢表示用のEmbedを作成
              const optionEmbed = new EmbedBuilder()
                .setTitle(`🎮 ${updatedItem.name} - コンテンツ選択`)
                .setDescription('以下から受け取りたいコンテンツを選択してください：')
                .setColor('#5865F2');
              
              // 選択メニューの作成
              const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`content_select_${updatedItem.id}_${discordUser.id}`)
                .setPlaceholder('コンテンツを選択...')
                .addOptions(
                  updatedItem.contentOptions.map((option, index) => ({
                    label: `選択肢 ${index + 1}`,
                    description: option.length > 100 ? option.substring(0, 97) + '...' : option,
                    value: index.toString()
                  }))
                );
              
              const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);
              
              await dm.send({
                embeds: [optionEmbed],
                components: [row]
              });
              
              console.log(`コンテンツ選択メニューを送信: ${interaction.user.username}`);
            } catch (dmError) {
              console.error('Error sending DM for content selection:', dmError);
              await interaction.followUp({
                content: `DM送信に失敗しました。プライバシー設定を確認してください。`,
                flags: MessageFlags.Ephemeral
              });
            }
          }
        } catch (error) {
          console.error('Error processing buy command:', error);
          await interaction.editReply({
            content: '購入処理中にエラーが発生しました。'
          });
        }
      }
      else if (customId.startsWith('confirm_buy_')) {
        // 購入確認処理
        const [_, __, itemId, quantity] = customId.split('_').map(Number);
        
        // 本来はここでハンドルバイコマンドを呼ぶべきだが、コード重複を避けるため直接処理
        try {
          const item = await storage.getItem(itemId);
          if (!item || !item.isActive || (!item.infiniteStock && item.stock < quantity)) {
            return await interaction.update({
              content: '商品が見つからないか、在庫が不足しています。',
              components: []
            });
          }
          
          const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
          if (!discordUser) {
            return await interaction.update({
              content: 'ユーザー情報が見つかりません。',
              components: []
            });
          }
          
          const totalPrice = item.price * quantity;
          
          if (discordUser.balance < totalPrice) {
            return await interaction.update({
              content: `残高が不足しています。必要: ${totalPrice} ${currencyName}、残高: ${discordUser.balance} ${currencyName}`,
              components: []
            });
          }
          
          // 購入処理実行
          await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
          // 無限在庫でなければ在庫を減らす
          if (!item.infiniteStock) {
            await storage.updateItem(item.id, { stock: item.stock - quantity });
          }
          
          // トランザクション記録
          await storage.createTransaction({
            discordUserId: discordUser.id,
            itemId: item.id,
            quantity: quantity,
            totalPrice: totalPrice
          });
          
          // ロール付与（該当する場合）
          if (item.discordRoleId && message.guild) {
            try {
              const member = await message.guild.members.fetch(interaction.user.id);
              await member.roles.add(item.discordRoleId);
            } catch (roleError) {
              console.error('Error adding role:', roleError);
            }
          }
          
          // 更新された残高を取得
          const updatedUser = await storage.getDiscordUser(discordUser.id);
          const newBalance = updatedUser ? updatedUser.balance : 0;
          
          await interaction.update({
            content: `✅ ${item.name} を ${quantity} 個購入しました！\n残高: ${newBalance} ${currencyName}`,
            components: []
          });
          
          // 公開メッセージ
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛒 商品が購入されました！')
            .setDescription(`${interaction.user.username} が ${item.name} を ${quantity} 個購入しました！`)
            .setColor('#3BA55C')
            .setTimestamp();
            
          await message.channel.send({ embeds: [publicEmbed] });
          
          // アイテムのコンテンツがある場合はDMで送信
          if (item.content) {
            try {
              // Discord.js v14では直接DMを送信できる
              await interaction.user.send({
                content: `🎁 商品の詳細情報: ${item.name}\n\n${item.content}`
              });
            } catch (dmError) {
              console.error('Error sending DM:', dmError);
              // DMが送れない場合はエフェメラルメッセージで通知
              await interaction.followUp({
                content: 'DMが送信できませんでした。プライバシー設定を確認してください。',
                flags: MessageFlags.Ephemeral
              });
            }
          }
        } catch (error) {
          console.error('Error processing buy:', error);
          await interaction.update({
            content: '購入処理中にエラーが発生しました。',
            components: []
          });
        }
      }
      else if (customId === 'cancel_buy') {
        // 購入キャンセル
        await interaction.update({
          content: '購入をキャンセルしました。',
          components: []
        });
      }
      else if (customId.startsWith('preview_')) {
        // 選択肢の表示処理
        const [_, itemId] = customId.split('_').map(Number);
        
        // 商品情報を取得
        const item = await storage.getItem(itemId);
        
        if (!item || !item.contentOptions || item.contentOptions.length === 0) {
          return await interaction.reply({
            content: '商品の選択肢情報が見つかりません。',
            flags: MessageFlags.Ephemeral
          });
        }
        
        // 選択肢を表示するEmbedを作成
        const embed = new EmbedBuilder()
          .setTitle(`📋 ${item.name} - 選択肢一覧`)
          .setDescription('購入後、以下の選択肢からDMで受け取るコンテンツを選べます。')
          .setColor('#5865F2');
        
        // 選択肢を表示
        item.contentOptions.forEach((option, index) => {
          embed.addFields({
            name: `選択肢 ${index + 1}`,
            value: option.length > 100 ? option.substring(0, 97) + '...' : option,
            inline: false
          });
        });
        
        // 購入ボタンを準備
        const buyButton = new ButtonBuilder()
          .setCustomId(`buy_${item.id}_1`)
          .setLabel(`購入する (${item.price} ${currencyName})`)
          .setStyle(ButtonStyle.Success)
          .setDisabled(item.stock <= 0 || balance < item.price);
        
        const backButton = new ButtonBuilder()
          .setCustomId('back_to_show')
          .setLabel('戻る')
          .setStyle(ButtonStyle.Secondary);
        
        const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(buyButton, backButton);
        
        await interaction.reply({
          embeds: [embed],
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }
      else if (customId === 'back_to_show') {
        // 商品一覧に戻る
        await interaction.update({
          content: '商品一覧に戻ります',
          embeds: [],
          components: []
        });
      }
      else if (customId.startsWith('cart_add_')) {
        // カートに追加
        const [_, __, itemId, quantity] = customId.split('_').map(Number);
        
        try {
          const item = await storage.getItem(itemId);
          if (!item || !item.isActive || item.stock < quantity) {
            return await interaction.reply({
              content: '商品が見つからないか、在庫が不足しています。',
              ephemeral: true
            });
          }
          
          // カートに追加
          addToCart(interaction.user.id, item, quantity);
          
          await interaction.reply({
            content: `${item.name} を ${quantity} 個カートに追加しました！\n確認するには \`!cart\` と入力してください。`,
            ephemeral: true
          });
        } catch (error) {
          console.error('Error adding to cart:', error);
          await interaction.reply({
            content: 'カートに追加中にエラーが発生しました。',
            ephemeral: true
          });
        }
      }
      else if (customId.startsWith('details_')) {
        // 商品詳細表示
        const itemId = Number(customId.split('_')[1]);
        const item = await storage.getItem(itemId);
        
        if (!item) {
          return await interaction.reply({
            content: '商品が見つかりません。',
            ephemeral: true
          });
        }
        
        const detailsEmbed = new EmbedBuilder()
          .setTitle(`商品詳細: ${item.name}`)
          .setDescription(item.description)
          .addFields(
            { name: '価格', value: `${item.price} ${currencyName}`, inline: true },
            { name: '在庫', value: `${item.stock}`, inline: true },
            { name: '商品ID', value: `${item.id}`, inline: true }
          )
          .setColor('#5865F2')
          .setFooter({ text: `!buy ${item.id} [数量] で購入、!cart add ${item.id} [数量] でカートに追加できます` });
        
        // 数量選択用セレクトメニュー
        const quantityRow = new ActionRowBuilder<StringSelectMenuBuilder>()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`quantity_select_${itemId}`)
              .setPlaceholder('購入数量を選択')
              .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('1個').setValue(`1_${itemId}`),
                new StringSelectMenuOptionBuilder().setLabel('2個').setValue(`2_${itemId}`),
                new StringSelectMenuOptionBuilder().setLabel('3個').setValue(`3_${itemId}`),
                new StringSelectMenuOptionBuilder().setLabel('5個').setValue(`5_${itemId}`),
                new StringSelectMenuOptionBuilder().setLabel('10個').setValue(`10_${itemId}`)
              )
          );
        
        // アクションボタン
        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`direct_buy_${itemId}_1`)
              .setLabel(`今すぐ購入`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(item.stock <= 0 || balance < item.price),
            new ButtonBuilder()
              .setCustomId(`cart_add_${itemId}_1`)
              .setLabel('カートに追加')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(item.stock <= 0)
          );
        
        await interaction.reply({
          embeds: [detailsEmbed],
          components: [quantityRow, actionRow],
          ephemeral: true
        });
      }
      else if (customId === 'view_cart') {
        // カートを表示
        await interaction.deferUpdate();
        await handleCartCommand(message, [], storage);
      }
      else if (customId === 'next_page' || customId === 'show_all') {
        // 次ページまたは全表示
        // 実装は複雑になるため、簡易表示に戻す
        await interaction.update({
          content: '追加の商品やすべての商品を見るには `!show all` コマンドを使用してください。',
          components: []
        });
      }
      else if (customId.startsWith('quantity_select_')) {
        // 数量選択処理
        const selectValues = interaction.values[0].split('_');
        const quantity = Number(selectValues[0]);
        const itemId = Number(selectValues[1]);
        
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.update({
            content: '商品が見つかりません。',
            components: []
          });
        }
        
        // 新しいボタンを生成
        const newRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`direct_buy_${itemId}_${quantity}`)
              .setLabel(`${quantity}個購入 (${item.price * quantity} ${currencyName})`)
              .setStyle(ButtonStyle.Success)
              .setDisabled(item.stock < quantity || balance < (item.price * quantity)),
            new ButtonBuilder()
              .setCustomId(`cart_add_${itemId}_${quantity}`)
              .setLabel(`${quantity}個カートに追加`)
              .setStyle(ButtonStyle.Primary)
              .setDisabled(item.stock < quantity)
          );
        
        await interaction.update({
          content: `${item.name} を ${quantity} 個選択しました。`,
          components: [newRow]
        });
      }
      else if (customId.startsWith('direct_buy_')) {
        // 詳細画面からの直接購入 - 確認なしで直接購入するように変更
        const [_, __, itemId, quantity] = customId.split('_').map(Number);
        
        // いったん確認画面を表示
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.reply({
            content: '商品が見つかりません。',
            ephemeral: true
          });
        }
        
        // ユーザー情報を取得
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (!discordUser) {
          return await interaction.reply({
            content: 'ユーザー情報が見つかりません。',
            ephemeral: true
          });
        }
        
        const totalPrice = item.price * quantity;
        
        // 残高確認
        if (discordUser.balance < totalPrice) {
          return await interaction.reply({
            content: `残高が不足しています。必要な金額: ${totalPrice} ${currencyName}、現在の残高: ${discordUser.balance} ${currencyName}`,
            ephemeral: true
          });
        }
        
        // 在庫確認
        if (!item.infiniteStock && item.stock < quantity) {
          return await interaction.reply({
            content: `在庫が不足しています。現在の在庫: ${item.stock}`,
            ephemeral: true
          });
        }
        
        try {
          // 処理中メッセージ
          await interaction.reply({
            content: `${item.name} ${quantity}個を購入中です...`,
            flags: MessageFlags.Ephemeral
          });
          
          // 残高を減らす
          await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
          
          // 在庫を減らす（無限在庫でない場合）
          if (!item.infiniteStock) {
            await storage.updateItem(item.id, { 
              stock: item.stock - quantity 
            });
          }
          
          // トランザクションを記録
          await storage.createTransaction({
            discordUserId: discordUser.id,
            itemId: item.id,
            quantity: quantity,
            totalPrice: totalPrice
          });
          
          // ロールを付与（該当する場合）
          if (item.discordRoleId && interaction.guild) {
            try {
              const member = await interaction.guild.members.fetch(interaction.user.id);
              await member.roles.add(item.discordRoleId);
            } catch (roleError) {
              console.error('Error adding role:', roleError);
              // ロール付与エラーは無視して続行
            }
          }
          
          // 更新された残高を取得
          const updatedUser = await storage.getDiscordUser(discordUser.id);
          const newBalance = updatedUser ? updatedUser.balance : 0;
          
          // 成功メッセージを表示
          await interaction.editReply({
            content: `✅ ${item.name} を ${quantity} 個購入しました！\n残高: ${newBalance} ${currencyName}`
          });
          
          // 公開メッセージ
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛒 商品が購入されました！')
            .setDescription(`${interaction.user.username} が ${item.name} を ${quantity} 個購入しました！`)
            .setColor('#3BA55C')
            .setTimestamp();
          
          await message.channel.send({ embeds: [publicEmbed] });
          
          // アイテムのコンテンツがある場合はDMで送信
          if (item.content) {
            try {
              await interaction.user.send({
                content: `🎁 商品の詳細情報: ${item.name}\n\n${item.content}`
              });
            } catch (dmError) {
              console.error('Error sending DM:', dmError);
              // DMが送れない場合は公開チャンネルで通知
              await interaction.followUp({
                content: `DM送信に失敗しました。プライバシー設定を確認してください。`,
                ephemeral: true
              });
            }
          }
        } catch (error) {
          console.error('Error processing direct purchase:', error);
          if (interaction.replied) {
            await interaction.editReply({
              content: '購入処理中にエラーが発生しました。もう一度お試しください。'
            });
          } else {
            await interaction.reply({
              content: '購入処理中にエラーが発生しました。もう一度お試しください。',
              ephemeral: true
            });
          }
        }
      }
    });
    
    // タイムアウト時の処理
    collector.on('end', async collected => {
      if (sentMessage.editable) {
        try {
          await sentMessage.edit({
            content: `表示が有効期限切れになりました。もう一度商品を表示するには \`!show\` と入力してください。`,
            components: []
          });
        } catch (error) {
          console.error('Error updating expired message:', error);
        }
      }
    });
  } catch (error) {
    console.error('Error in show command:', error);
    await message.reply('商品リストの取得中にエラーが発生しました。');
  }
}

// Buy command for ! prefix
async function handleBuyCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // ヘルプテキスト
    if (args.length === 0 || args[0] === 'help') {
      return await message.reply('使用方法: `!buy [商品ID] [数量(省略可)]`\n例: `!buy 1 2` - ID:1の商品を2個購入\n複数商品の購入には `!cart` と `!checkout` コマンドが便利です。');
    }
    
    // Get item ID and quantity from arguments
    const itemId = parseInt(args[0]);
    const quantity = args.length > 1 ? parseInt(args[1]) : 1;
    
    if (isNaN(itemId) || isNaN(quantity) || quantity < 1) {
      return await message.reply('有効な商品IDと数量を指定してください。例: `!buy 1 2`');
    }
    
    // Get the item
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    if (!item.isActive) {
      return await message.reply('この商品は現在販売停止中です。');
    }
    
    if (item.stock < quantity) {
      return await message.reply(`在庫が不足しています。現在の在庫: ${item.stock}`);
    }
    
    // 選択オプションと購入確認ボタンを準備
    const totalPrice = item.price * quantity;
    let selectedOption: string | null = null;
    let selectedContentIndex: number | null = null;
    
    // メッセージの内容を準備
    let contentText = `${item.name} を ${quantity} 個、合計 ${totalPrice} コインで購入しますか？`;
    
    // 確認ボタンの準備
    const confirmButton = new ButtonBuilder()
      .setCustomId(`confirm_buy_${item.id}_${quantity}`)
      .setLabel('購入する')
      .setStyle(ButtonStyle.Success);
      
    const cancelButton = new ButtonBuilder()
      .setCustomId(`cancel_buy_${item.id}_${quantity}`)
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary);
    
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    
    // 選択肢がある場合は選択メニューを追加
    const components: any[] = [confirmRow];
    
    // 商品の選択肢があれば追加
    if (item.options && item.options.length > 0) {
      contentText += '\n\n**商品の選択肢から1つ選んでください**:';
      
      // 選択メニューを作成
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('option_select')
        .setPlaceholder('商品の選択肢を選んでください')
        .addOptions(
          item.options.map(option => ({
            label: option,
            value: option
          }))
        );
      
      const selectRow = new ActionRowBuilder<any>().addComponents(selectMenu);
      components.unshift(selectRow); // 選択肢を先に表示
    }
    
    // コンテンツオプション（DMで送信する選択肢）があれば追加
    if (item.contentOptions && item.contentOptions.length > 0) {
      contentText += '\n\n**DMで受け取るコンテンツを選択してください**:';
      
      // コンテンツオプション選択メニューを作成
      const contentSelectMenu = new StringSelectMenuBuilder()
        .setCustomId('content_option_select')
        .setPlaceholder('DMで受け取るコンテンツを選択')
        .addOptions(
          item.contentOptions.map((option, index) => ({
            label: `コンテンツオプション ${index + 1}`, 
            description: option.length > 90 ? option.substring(0, 90) + '...' : option,
            value: `content_${index}`
          }))
        );
      
      const contentSelectRow = new ActionRowBuilder<any>().addComponents(contentSelectMenu);
      components.unshift(contentSelectRow); // コンテンツ選択肢を一番上に表示
    }
    
    // 確認メッセージを送信
    const confirmMessage = await message.reply({
      content: contentText,
      components: components
    });
    
    // インタラクションコレクターを作成
    const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 60000, // 60秒間有効
    });
    
    // Handle interactions (both buttons and select menu)
    collector.on('collect', async (interaction) => {
      try {
        console.log(`Interaction received: ${interaction.customId}`);
        
        // Handle product option select menu interaction
        if (interaction.customId === 'option_select' && interaction.isStringSelectMenu()) {
          selectedOption = interaction.values[0];
          
          // Update message with selected option
          let updatedContent = contentText;
          if (selectedOption) {
            updatedContent += `\n\n選択された商品オプション: **${selectedOption}**`;
          }
          if (selectedContentIndex !== null && item.contentOptions && item.contentOptions[selectedContentIndex]) {
            updatedContent += `\n\n選択されたDMコンテンツ: **オプション ${selectedContentIndex + 1}**`;
          }
          
          await interaction.update({
            content: updatedContent,
            components: components
          });
          return;
        }
        
        // Handle content option select menu interaction
        if (interaction.customId === 'content_option_select' && interaction.isStringSelectMenu()) {
          const selectedValue = interaction.values[0];
          if (selectedValue.startsWith('content_')) {
            // Extract the index from the value (format: 'content_X')
            selectedContentIndex = parseInt(selectedValue.split('_')[1]);
            
            // Update message with selected content option
            let updatedContent = contentText;
            if (selectedOption) {
              updatedContent += `\n\n選択された商品オプション: **${selectedOption}**`;
            }
            if (selectedContentIndex !== null && item.contentOptions && item.contentOptions[selectedContentIndex]) {
              updatedContent += `\n\n選択されたDMコンテンツ: **オプション ${selectedContentIndex + 1}**`;
            }
            
            await interaction.update({
              content: updatedContent,
              components: components
            });
          }
          return;
        }
        
        // Handle purchase confirmation
        if (interaction.customId === 'confirm_purchase' || interaction.customId.startsWith('confirm_buy_')) {
          console.log('Processing purchase confirmation');
          
          // Check if product option is selected when required
          if (item.options && item.options.length > 0 && !selectedOption) {
            await interaction.update({
              content: `${contentText}\n\n⚠️ 商品オプションを選択してください。`,
              components: components
            });
            return;
          }
          
          // Check if content option is selected when required
          if (item.contentOptions && item.contentOptions.length > 0 && selectedContentIndex === null) {
            await interaction.update({
              content: `${contentText}\n\n⚠️ DMで受け取るコンテンツを選択してください。`,
              components: components
            });
            return;
          }
          
          // Get user info
          const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
          if (!discordUser) {
            await interaction.update({
              content: 'ユーザー情報が見つかりません。',
              components: []
            });
            return;
          }
          
          // Verify item stock
          const updatedItem = await storage.getItem(itemId);
          if (!updatedItem || (!updatedItem.infiniteStock && updatedItem.stock < quantity)) {
            await interaction.update({
              content: '申し訳ありません。在庫状況が変更されました。',
              components: []
            });
            return;
          }
          
          // Check balance
          if (discordUser.balance < totalPrice) {
            await interaction.update({
              content: `残高が不足しています。必要な金額: ${totalPrice} コイン、現在の残高: ${discordUser.balance} コイン`,
              components: []
            });
            return;
          }
          
          try {
            // Update balance and stock
            await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
            
            if (!updatedItem.infiniteStock) {
              await storage.updateItem(updatedItem.id, { 
                stock: updatedItem.stock - quantity 
              });
            }
            
            // Record transaction
            await storage.createTransaction({
              discordUserId: discordUser.id,
              itemId: updatedItem.id,
              quantity: quantity,
              totalPrice: totalPrice
            });
            
            // Assign role if applicable
            if (updatedItem.discordRoleId && message.guild) {
              try {
                const member = await message.guild.members.fetch(message.author.id);
                await member.roles.add(updatedItem.discordRoleId);
              } catch (roleError) {
                console.error('Error adding role:', roleError);
              }
            }
            
            // Get updated balance
            const updatedUser = await storage.getDiscordUser(discordUser.id);
            const newBalance = updatedUser ? updatedUser.balance : 0;
            
            // Create success message
            let successMessage = `✅ ${updatedItem.name} を ${quantity} 個購入しました！\n残高: ${newBalance} コイン`;
            
            if (selectedOption) {
              successMessage += `\n\n選択されたオプション: **${selectedOption}**`;
            }
            
            if (updatedItem.content) {
              successMessage += `\n\n📩 商品の詳細はDMをご確認ください。`;
            }
            
            // Update interaction
            await interaction.update({
              content: successMessage,
              components: []
            });
            
            // Send DM if item has content
            if (updatedItem.content) {
              try {
                const dmChannel = await message.author.createDM();
                let dmContent = `**${updatedItem.name}** の購入ありがとうございます！\n\n`;
                
                if (selectedOption) {
                  dmContent += `選択されたオプション: **${selectedOption}**\n\n`;
                }
                
                dmContent += `ここに購入した商品の内容を記載します:\n\n${updatedItem.content}`;
                
                await dmChannel.send({
                  content: dmContent
                });
              } catch (dmError) {
                console.error("Failed to send DM:", dmError);
              }
            }
            
            // Send public announcement
            const publicEmbed = new EmbedBuilder()
              .setTitle('🛒 商品が購入されました！')
              .setDescription(`${message.author.username} が ${updatedItem.name} を ${quantity} 個購入しました！`)
              .setColor('#3BA55C')
              .setTimestamp();
              
            await message.channel.send({ embeds: [publicEmbed] });
          } catch (purchaseError) {
            console.error('Error processing purchase:', purchaseError);
            await interaction.update({
              content: '購入処理中にエラーが発生しました。',
              components: []
            });
          }
        } else if (interaction.customId === 'cancel_purchase' || interaction.customId.startsWith('cancel_buy_')) {
          await interaction.update({
            content: '購入をキャンセルしました。',
            components: []
          });
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        try {
          await interaction.update({
            content: 'エラーが発生しました。もう一度お試しください。',
            components: []
          });
        } catch (followupError) {
          console.error('Error sending error message:', followupError);
        }
      }
    });
    
    // Handle timeout
    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await confirmMessage.edit({
          content: '時間切れです。購入がキャンセルされました。',
          components: []
        });
      }
    });
  } catch (error) {
    console.error('Error in buy command:', error);
    await message.reply('購入処理中にエラーが発生しました。');
  }
}

// Cart command for ! prefix
async function handleCartCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // ヘルプテキスト
    if (args.length > 0 && args[0] === 'help') {
      return await message.reply(
        '使用方法:\n' +
        '`!cart` - カートの内容を表示\n' +
        '`!cart add [商品ID] [数量(省略可)]` - カートに商品を追加\n' +
        '`!cart remove [商品ID] [数量(省略可)]` - カートから商品を削除\n' +
        '`!cart clear` - カートを空にする'
      );
    }
    
    const subCommand = args.length > 0 ? args[0].toLowerCase() : 'show';
    
    // サブコマンドに基づいて処理
    switch (subCommand) {
      case 'show':
        // カートの内容を表示
        const cart = getUserCart(message.author.id);
        
        if (cart.items.length === 0) {
          return await message.reply('カートは空です。`!show` で商品一覧を確認し、`!cart add [商品ID] [数量]` でカートに追加できます。');
        }
        
        // カート内容をEmbedで表示
        const cartEmbed = new EmbedBuilder()
          .setTitle('🛒 ショッピングカート')
          .setDescription(`${message.author.username} さんのカート内容:`)
          .setColor('#5865F2');
          
        let total = 0;
        cart.items.forEach(item => {
          const itemTotal = item.price * item.quantity;
          total += itemTotal;
          cartEmbed.addFields({
            name: `${item.name} (ID: ${item.itemId})`,
            value: `${item.quantity} 個 × ${item.price} コイン = ${itemTotal} コイン`
          });
        });
        
        cartEmbed.addFields({
          name: '合計',
          value: `${total} コイン`
        });
        
        cartEmbed.setFooter({
          text: '購入するには !checkout コマンドを使用してください'
        });
        
        // ボタンを追加
        const checkoutButton = new ButtonBuilder()
          .setCustomId('checkout')
          .setLabel('購入手続きへ')
          .setStyle(ButtonStyle.Success);
          
        const clearButton = new ButtonBuilder()
          .setCustomId('clear_cart')
          .setLabel('カートを空にする')
          .setStyle(ButtonStyle.Danger);
          
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(checkoutButton, clearButton);
        
        const cartMessage = await message.reply({
          embeds: [cartEmbed],
          components: [row]
        });
        
        // ボタンコレクターを作成
        const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
        const collector = cartMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000, // 60秒間有効
          componentType: ComponentType.Button
        });
        
        collector.on('collect', async (interaction) => {
          if (interaction.customId === 'checkout') {
            await interaction.update({
              components: []
            });
            
            // チェックアウト処理を実行
            await handleCheckoutCommand(message, storage);
          } else if (interaction.customId === 'clear_cart') {
            clearCart(message.author.id);
            await interaction.update({
              content: 'カートを空にしました。',
              embeds: [],
              components: []
            });
          }
        });
        
        break;
        
      case 'add':
        // カートに商品を追加
        if (args.length < 2) {
          return await message.reply('使用方法: `!cart add [商品ID] [数量(省略可)]`');
        }
        
        const addItemId = parseInt(args[1]);
        const addQuantity = args.length > 2 ? parseInt(args[2]) : 1;
        
        if (isNaN(addItemId) || isNaN(addQuantity) || addQuantity < 1) {
          return await message.reply('有効な商品IDと数量を指定してください。');
        }
        
        // 商品情報を取得
        const itemToAdd = await storage.getItem(addItemId);
        if (!itemToAdd) {
          return await message.reply('指定された商品が見つかりません。');
        }
        
        if (!itemToAdd.isActive) {
          return await message.reply('この商品は現在販売停止中です。');
        }
        
        // 無限在庫でなければ在庫チェック
        if (!itemToAdd.infiniteStock && itemToAdd.stock < addQuantity) {
          return await message.reply(`在庫が不足しています。現在の在庫: ${itemToAdd.stock}`);
        }
        
        // カートに追加
        addToCart(message.author.id, itemToAdd, addQuantity);
        
        await message.reply(`${itemToAdd.name} を ${addQuantity} 個カートに追加しました！カートを確認するには \`!cart\` と入力してください。`);
        break;
        
      case 'remove':
        // カートから商品を削除
        if (args.length < 2) {
          return await message.reply('使用方法: `!cart remove [商品ID] [数量(省略可)]`');
        }
        
        const removeItemId = parseInt(args[1]);
        const removeQuantity = args.length > 2 ? parseInt(args[2]) : 1;
        
        if (isNaN(removeItemId) || isNaN(removeQuantity) || removeQuantity < 1) {
          return await message.reply('有効な商品IDと数量を指定してください。');
        }
        
        // カートから削除
        const userCart = getUserCart(message.author.id);
        const itemInCart = userCart.items.find(item => item.itemId === removeItemId);
        
        if (!itemInCart) {
          return await message.reply('指定された商品はカートに入っていません。');
        }
        
        removeFromCart(message.author.id, removeItemId, removeQuantity);
        
        await message.reply(`${itemInCart.name} を ${Math.min(removeQuantity, itemInCart.quantity)} 個カートから削除しました。`);
        break;
        
      case 'clear':
        // カートを空にする
        clearCart(message.author.id);
        await message.reply('カートを空にしました。');
        break;
        
      default:
        await message.reply('無効なサブコマンドです。`!cart help` でヘルプを表示します。');
        break;
    }
  } catch (error) {
    console.error('Error in cart command:', error);
    await message.reply('カート処理中にエラーが発生しました。');
  }
}

// Checkout command for ! prefix
async function handleCheckoutCommand(message: Message, storage: IStorage) {
  try {
    // カートの内容を取得
    const cart = getUserCart(message.author.id);
    
    if (cart.items.length === 0) {
      return await message.reply('カートは空です。`!show` で商品一覧を確認し、`!cart add [商品ID] [数量]` でカートに追加できます。');
    }
    
    // ユーザー情報を取得
    let discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    
    if (!discordUser) {
      // ユーザーが存在しない場合は作成（初期残高0）
      discordUser = await storage.createDiscordUser({
        discordId: message.author.id,
        username: message.author.username,
        balance: 0 // 初期残高0に設定
      });
    }
    
    // 合計金額を計算
    const total = getCartTotal(message.author.id);
    
    // 残高チェック
    if (discordUser.balance < total) {
      return await message.reply(`残高が不足しています。必要な金額: ${total} コイン、現在の残高: ${discordUser.balance} コイン`);
    }
    
    // 在庫チェック
    let stockError = false;
    const stockChecks = await Promise.all(cart.items.map(async (item) => {
      const dbItem = await storage.getItem(item.itemId);
      // 無限在庫アイテムでなく、かつ在庫が不足している場合
      if (!dbItem || (!dbItem.infiniteStock && dbItem.stock < item.quantity)) {
        stockError = true;
        return `${item.name}: 在庫不足（要求: ${item.quantity}、在庫: ${dbItem ? dbItem.stock : 0}）`;
      }
      return null;
    }));
    
    if (stockError) {
      const errorItems = stockChecks.filter(Boolean).join('\n');
      return await message.reply(`次の商品で在庫が不足しています:\n${errorItems}`);
    }
    
    // 確認メッセージを表示
    const confirmEmbed = new EmbedBuilder()
      .setTitle('🛒 購入確認')
      .setDescription('以下の内容で購入を確定しますか？')
      .setColor('#5865F2');
      
    cart.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      confirmEmbed.addFields({
        name: `${item.name}`,
        value: `${item.quantity} 個 × ${item.price} コイン = ${itemTotal} コイン`
      });
    });
    
    confirmEmbed.addFields(
      { name: '合計金額', value: `${total} コイン` },
      { name: '購入後残高', value: `${discordUser.balance - total} コイン` }
    );
    
    // 確認ボタンを追加
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_checkout')
      .setLabel('購入確定')
      .setStyle(ButtonStyle.Success);
      
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_checkout')
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    
    const confirmMessage = await message.reply({
      embeds: [confirmEmbed],
      components: [row]
    });
    
    // ボタンコレクターを作成
    const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 60000, // 60秒間有効
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'confirm_checkout') {
        try {
          // 再度ユーザー情報と在庫を確認
          const updatedUser = await storage.getDiscordUserByDiscordId(message.author.id);
          if (!updatedUser || updatedUser.balance < total) {
            await interaction.update({
              content: '残高が不足しています。',
              embeds: [],
              components: []
            });
            return;
          }
          
          // 在庫を再チェック
          let stockErrorFound = false;
          for (const item of cart.items) {
            const dbItem = await storage.getItem(item.itemId);
            if (!dbItem || (!dbItem.infiniteStock && dbItem.stock < item.quantity)) {
              stockErrorFound = true;
              break;
            }
          }
          
          if (stockErrorFound) {
            await interaction.update({
              content: '申し訳ありません。在庫状況が変更されました。',
              embeds: [],
              components: []
            });
            return;
          }
          
          // 購入処理を実行
          // 1. 残高を減らす
          await storage.updateDiscordUserBalance(updatedUser.id, -total);
          
          // 2. 各商品の処理
          const transactions = [];
          for (const item of cart.items) {
            // 在庫を減らす（無限在庫でない場合のみ）
            const dbItem = await storage.getItem(item.itemId);
            if (dbItem) {
              if (!dbItem.infiniteStock) {
                await storage.updateItem(dbItem.id, { stock: dbItem.stock - item.quantity });
              }
              
              // トランザクション記録を作成
              const transaction = await storage.createTransaction({
                discordUserId: updatedUser.id,
                itemId: dbItem.id,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity
              });
              
              transactions.push(transaction);
              
              // ロールを付与（該当する場合）
              if (dbItem.discordRoleId && message.guild) {
                try {
                  const member = await message.guild.members.fetch(message.author.id);
                  await member.roles.add(dbItem.discordRoleId);
                } catch (roleError) {
                  console.error('Error adding role:', roleError);
                  // ロール付与に失敗しても購入処理は続行
                }
              }
            }
          }
          
          // 更新されたユーザー情報を取得
          const finalUser = await storage.getDiscordUser(updatedUser.id);
          
          // カートを空にする
          clearCart(message.author.id);
          
          // 成功メッセージを表示
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ 購入完了')
            .setDescription('以下の商品の購入が完了しました！')
            .setColor('#3BA55C')
            .setTimestamp();
            
          cart.items.forEach(item => {
            successEmbed.addFields({
              name: item.name,
              value: `${item.quantity} 個`
            });
          });
          
          successEmbed.addFields({
            name: '合計金額',
            value: `${total} コイン`
          });
          
          if (finalUser) {
            successEmbed.addFields({
              name: '残高',
              value: `${finalUser.balance} コイン`
            });
          }
          
          await interaction.update({
            embeds: [successEmbed],
            components: []
          });
          
          // DMで購入した商品の詳細を送信
          try {
            const dmEmbed = new EmbedBuilder()
              .setTitle('🎉 購入完了のお知らせ')
              .setDescription('ご購入いただきありがとうございます。以下が購入内容です。')
              .setColor('#3BA55C')
              .setTimestamp();
            
            // 各商品の詳細情報をDMに含める
            for (const cartItem of cart.items) {
              const dbItem = await storage.getItem(cartItem.itemId);
              if (dbItem) {
                // 選択されたコンテンツオプションがあれば使用する
                let contentValue = dbItem.content || dbItem.description || 'コンテンツはありません';
                
                // カートアイテムが現在のアイテムと同じで、コンテンツオプションが選択されていれば使用
                if (dbItem.id === itemId && selectedContentIndex !== null && 
                    dbItem.contentOptions && dbItem.contentOptions[selectedContentIndex]) {
                  contentValue = dbItem.contentOptions[selectedContentIndex];
                  
                  // 使用したコンテンツオプションを削除するために、商品を更新する準備
                  const updatedContentOptions = [...dbItem.contentOptions];
                  updatedContentOptions.splice(selectedContentIndex, 1);
                  
                  // 商品を更新してコンテンツオプションを削除
                  await storage.updateItem(dbItem.id, {
                    contentOptions: updatedContentOptions
                  });
                  
                  console.log(`Content option at index ${selectedContentIndex} has been removed from item ID ${dbItem.id}`);
                }
                
                dmEmbed.addFields({
                  name: `${dbItem.name} (${cartItem.quantity}個)`,
                  value: contentValue
                });
              }
            }
            
            await message.author.send({ embeds: [dmEmbed] });
          } catch (dmError) {
            console.error('Error sending DM:', dmError);
            // DMが送信できない場合はチャンネルで通知
            await message.channel.send({ 
              content: `${message.author}さん、DMが送信できませんでした。プライバシー設定を確認してください。` 
            });
          }
          
          // 購入通知を送信（公開チャンネル）
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛍️ 商品が購入されました！')
            .setDescription(`${message.author.username} が ${cart.items.length} 種類の商品を購入しました！詳細はDMで送信されました。`)
            .setColor('#3BA55C')
            .setTimestamp();
            
          await message.channel.send({ embeds: [publicEmbed] });
        } catch (error) {
          console.error('Error processing checkout:', error);
          await interaction.update({
            content: '購入処理中にエラーが発生しました。',
            embeds: [],
            components: []
          });
        }
      } else if (interaction.customId === 'cancel_checkout') {
        await interaction.update({
          content: '購入をキャンセルしました。',
          embeds: [],
          components: []
        });
      }
    });
    
    // タイムアウト処理
    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await confirmMessage.edit({
          content: '時間切れです。購入がキャンセルされました。',
          embeds: [],
          components: []
        });
      }
    });
  } catch (error) {
    console.error('Error in checkout command:', error);
    await message.reply('購入処理中にエラーが発生しました。');
  }
}

// Help command for ! prefix
async function handleHelpCommand(message: Message) {
  try {
    const helpEmbed = new EmbedBuilder()
      .setTitle('じはんきbot ヘルプ')
      .setDescription('利用可能なコマンド一覧')
      .setColor('#5865F2')
      .addFields(
        { name: '!show', value: '販売中の商品一覧を表示します' },
        { name: '!buy [商品ID] [数量]', value: '指定した商品を直接購入します' },
        { name: '!cart', value: '現在のカート内容を表示します' },
        { name: '!cart add [商品ID] [数量]', value: 'カートに商品を追加します' },
        { name: '!cart remove [商品ID] [数量]', value: 'カートから商品を削除します' },
        { name: '!cart clear', value: 'カートを空にします' },
        { name: '!checkout', value: 'カート内の商品を購入します' },
        { name: '!balance', value: '現在の残高を確認します' },
        { name: '!help', value: 'このヘルプメッセージを表示します' }
      )
      .setFooter({ text: 'じはんきbot by Replit' });
      
    // 管理者向けコマンド（オプション）
    // メッセージ送信者が管理者権限を持っている場合のみ表示
    if (message.member && message.member.permissions.has('Administrator')) {
      helpEmbed.addFields(
        { 
          name: '管理者コマンド', 
          value: '以下のコマンドは管理者のみ使用できます'
        },
        { name: '!add [名前] [説明] [価格] [在庫]', value: '新しい商品を追加します' },
        { name: '!price [商品ID] [新価格]', value: '商品の価格を変更します' },
        { name: '!stock [商品ID] [数量]', value: '商品の在庫を追加します' },
        { name: '!remove [商品ID]', value: '商品を削除します' },
        { name: '!addcoins @username [コイン数]', value: '特定のユーザーにコインを追加します' }
      );
    }
    
    await message.reply({ embeds: [helpEmbed] });
  } catch (error) {
    console.error('Error in help command:', error);
    await message.reply('ヘルプ表示中にエラーが発生しました。');
  }
}

// Balance command for ! prefix
async function handleBalanceCommand(message: Message, storage: IStorage) {
  try {
    // Get the user
    const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    if (!discordUser) {
      return await message.reply('ユーザー情報が見つかりません。');
    }
    
    // Get bot settings or use defaults
    const guildSettings = await storage.getBotSettings(message.guildId || '');
    const currencyName = guildSettings?.currencyName || 'コイン';
    
    // Send balance message
    await message.reply(`現在の残高: ${discordUser.balance} ${currencyName}`);
  } catch (error) {
    console.error('Error in balance command:', error);
    await message.reply('残高の確認中にエラーが発生しました。');
  }
}

// Add command for ! prefix
async function handleAddCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    // Example format: !add "Item Name" 500 "Item Description" 10 role_id
    // We need to parse more complex arguments with quotes
    const fullText = args.join(' ');
    const nameMatch = fullText.match(/"([^"]+)"/);
    
    if (!nameMatch) {
      return await message.reply('商品名を引用符で囲んで指定してください。例: `!add "プレミアムロール" 500 "説明文" 10`');
    }
    
    const name = nameMatch[1];
    const remainingText = fullText.replace(nameMatch[0], '').trim();
    const parts = remainingText.split(' ');
    
    const price = parseInt(parts[0]);
    if (isNaN(price) || price < 0) {
      return await message.reply('有効な価格を指定してください。');
    }
    
    const descMatch = remainingText.match(/"([^"]+)"/);
    if (!descMatch) {
      return await message.reply('説明文を引用符で囲んで指定してください。例: `!add "プレミアムロール" 500 "説明文" 10`');
    }
    
    const description = descMatch[1];
    const afterDesc = remainingText.replace(descMatch[0], '').trim().split(' ');
    
    const stock = parseInt(afterDesc[1]) || 0;
    const roleId = afterDesc[2] || null;
    
    // Create the item
    const item = await storage.createItem({
      name,
      description,
      price,
      stock,
      isActive: true,
      discordRoleId: roleId
    });
    
    await message.reply(`商品を追加しました：${item.name} (ID: ${item.id}, 価格: ${item.price} コイン)`);
  } catch (error) {
    console.error('Error in add command:', error);
    await message.reply('商品の追加中にエラーが発生しました。');
  }
}

// Remove command for ! prefix
async function handleRemoveCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    if (isNaN(itemId)) {
      return await message.reply('有効な商品IDを指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Delete the item
    await storage.deleteItem(itemId);
    
    await message.reply(`商品を削除しました：${item.name} (ID: ${item.id})`);
  } catch (error) {
    console.error('Error in remove command:', error);
    await message.reply('商品の削除中にエラーが発生しました。');
  }
}

// Price command for ! prefix
async function handlePriceCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    const newPrice = parseInt(args[1]);
    
    if (isNaN(itemId) || isNaN(newPrice)) {
      return await message.reply('有効な商品IDと価格を指定してください。例: `!price 1 500`');
    }
    
    if (newPrice < 0) {
      return await message.reply('価格は0以上の値を指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Update the item price
    const updatedItem = await storage.updateItem(itemId, { price: newPrice });
    
    await message.reply(`商品の価格を変更しました：${updatedItem?.name} (新価格: ${newPrice} コイン)`);
  } catch (error) {
    console.error('Error in price command:', error);
    await message.reply('価格の変更中にエラーが発生しました。');
  }
}

// Stock command for ! prefix
async function handleStockCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    const quantity = parseInt(args[1]);
    
    if (isNaN(itemId) || isNaN(quantity)) {
      return await message.reply('有効な商品IDと在庫数を指定してください。例: `!stock 1 10`');
    }
    
    if (quantity < 0) {
      return await message.reply('在庫数は0以上の値を指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Update the item stock
    const updatedItem = await storage.updateItem(itemId, { stock: quantity });
    
    await message.reply(`商品の在庫数を変更しました：${updatedItem?.name} (新在庫数: ${quantity})`);
  } catch (error) {
    console.error('Error in stock command:', error);
    await message.reply('在庫数の変更中にエラーが発生しました。');
  }
}

// Register all commands with the Discord client
// コイン追加コマンド for ! prefix
async function handleAddCoinsCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // 管理者権限チェック
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    // 引数チェック: !addcoins @username 500
    if (args.length < 2) {
      return await message.reply('使用方法: `!addcoins @username [コイン数]`');
    }
    
    const userMention = args[0];
    const amount = parseInt(args[1]);
    
    if (isNaN(amount) || amount <= 0) {
      return await message.reply('コイン数は正の整数で指定してください。');
    }
    
    // メンションからユーザーIDを抽出
    let userId = userMention;
    if (userMention.startsWith('<@') && userMention.endsWith('>')) {
      userId = userMention.slice(2, -1);
      if (userId.startsWith('!')) {
        userId = userId.slice(1);
      }
    }
    
    // ユーザー存在チェック
    let discordUser = await storage.getDiscordUserByDiscordId(userId);
    
    if (!discordUser) {
      const mentionedUser = await message.client.users.fetch(userId).catch(() => null);
      if (!mentionedUser) {
        return await message.reply('指定されたユーザーが見つかりません。');
      }
      
      // ユーザーが存在しない場合は作成
      discordUser = await storage.createDiscordUser({
        discordId: userId,
        username: mentionedUser.username,
        balance: 0
      });
    }
    
    // 残高更新
    const updatedUser = await storage.updateDiscordUserBalance(discordUser.id, amount);
    if (!updatedUser) {
      return await message.reply('残高の更新に失敗しました。');
    }
    
    // 成功メッセージ
    const guildSettings = await storage.getBotSettings(message.guild?.id || '');
    const currencyName = guildSettings?.currencyName || 'コイン';
    
    // 成功メッセージ（エンベッド）
    const successEmbed = new EmbedBuilder()
      .setTitle('💰 残高追加完了')
      .setDescription(`${userMention} に ${amount} ${currencyName}を追加しました！`)
      .addFields({ 
        name: '新しい残高', 
        value: `${updatedUser.balance} ${currencyName}` 
      })
      .setColor('#3BA55C')
      .setTimestamp();
    
    await message.reply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('Error adding coins:', error);
    await message.reply('コイン追加中にエラーが発生しました。エラー詳細はサーバーログを確認してください。');
  }
}

// スラッシュコマンドバージョンのコイン追加コマンド
const addCoinsCommand = {
  data: new SlashCommandBuilder()
    .setName('vending_addcoins')
    .setDescription('ユーザーにコインを追加します')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option => 
      option.setName('user')
        .setDescription('コインを追加するユーザー')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('amount')
        .setDescription('追加するコイン数（正の整数）')
        .setMinValue(1)
        .setRequired(true)),
  async execute(interaction: CommandInteraction, storage: IStorage) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
      const options = interaction.options;
      const user = options.getUser('user');
      const amount = options.getInteger('amount');
      
      if (!user || !amount) {
        return await interaction.editReply('ユーザーとコイン数が必要です。');
      }
      
      // ユーザー存在チェック
      let discordUser = await storage.getDiscordUserByDiscordId(user.id);
      
      if (!discordUser) {
        // ユーザーが存在しない場合は作成
        discordUser = await storage.createDiscordUser({
          discordId: user.id,
          username: user.username,
          balance: 0
        });
      }
      
      // 残高更新
      const updatedUser = await storage.updateDiscordUserBalance(discordUser.id, amount);
      
      if (!updatedUser) {
        return await interaction.editReply('残高の更新に失敗しました。');
      }
      
      // 成功メッセージ
      const guildSettings = await storage.getBotSettings(interaction.guildId || '');
      const currencyName = guildSettings?.currencyName || 'コイン';
      
      // 成功メッセージ（エンベッド）
      const successEmbed = new EmbedBuilder()
        .setTitle('💰 残高追加完了')
        .setDescription(`<@${user.id}> に ${amount} ${currencyName}を追加しました！`)
        .addFields({ 
          name: '新しい残高', 
          value: `${updatedUser.balance} ${currencyName}` 
        })
        .setColor('#3BA55C')
        .setTimestamp();
      
      await interaction.editReply({ embeds: [successEmbed] });
      
      // 公開チャンネルにも通知（オプション）
      const publicEmbed = new EmbedBuilder()
        .setTitle('💰 残高追加')
        .setDescription(`<@${interaction.user.id}> が <@${user.id}> に ${amount} ${currencyName}を追加しました！`)
        .setColor('#3BA55C')
        .setTimestamp();
        
      if (interaction.channel) {
        await interaction.channel.send({ embeds: [publicEmbed] });
      }
    } catch (error) {
      console.error('Error adding coins:', error);
      await interaction.editReply('コイン追加中にエラーが発生しました。');
    }
  }
};

export async function registerCommands(client: BotClient) {
  // Show command - displays all items in the vending machine
  const showCommand = {
    data: new SlashCommandBuilder()
      .setName('show')
      .setDescription('販売中の商品リストを表示します'),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply();
      
      try {
        const items = await storage.getItems();
        const activeItems = items.filter(item => item.isActive);
        
        // Get bot settings or use defaults
        const guildSettings = await storage.getBotSettings(interaction.guildId || '');
        const currencyName = guildSettings?.currencyName || 'コイン';
        
        // Create embed for the vending machine
        const embed = new EmbedBuilder()
          .setTitle('自動販売機')
          .setDescription(`以下の商品が販売中です！購入するには \`!buy [商品ID]\` または \`!cart add [商品ID]\` を使用してください`)
          .setColor('#5865F2');
          
        // Add fields for each item
        activeItems.forEach(item => {
          const stockStatus = item.stock > 0 
            ? `在庫: ${item.stock}`
            : '在庫切れ';
            
          embed.addFields({
            name: `#${item.id.toString().padStart(3, '0')} ${item.name}`,
            value: `${item.description}\n価格: **${item.price} ${currencyName}** | ${stockStatus}`,
            inline: false
          });
        });
        
        // Get user balance
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (discordUser) {
          embed.setFooter({ 
            text: `残高: ${discordUser.balance} ${currencyName}` 
          });
        }
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error in show command:', error);
        await interaction.editReply('商品リストの取得中にエラーが発生しました。');
      }
    },
  };
  
  // Buy command - purchases an item from the vending machine
  const buyCommand = {
    data: new SlashCommandBuilder()
      .setName('buy')
      .setDescription('指定した商品を購入します')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('購入する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('quantity')
          .setDescription('購入する数量')
          .setRequired(false)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Get item ID and quantity from options
        const itemId = interaction.options.getInteger('item_id');
        const quantity = interaction.options.getInteger('quantity') || 1;
        
        if (!itemId || quantity < 1) {
          return await interaction.editReply('有効な商品IDと数量を指定してください。');
        }
        
        // Get the item
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        if (!item.isActive) {
          return await interaction.editReply('この商品は現在販売停止中です。');
        }
        
        // 無限在庫でなければ在庫チェック
        if (!item.infiniteStock && item.stock < quantity) {
          return await interaction.editReply(`在庫が不足しています。現在の在庫: ${item.stock}`);
        }
        
        // Get the user
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (!discordUser) {
          return await interaction.editReply('ユーザー情報が見つかりません。');
        }
        
        // Calculate total price
        const totalPrice = item.price * quantity;
        
        // Check if user has enough balance
        if (discordUser.balance < totalPrice) {
          return await interaction.editReply(`残高が不足しています。必要な金額: ${totalPrice} コイン、現在の残高: ${discordUser.balance} コイン`);
        }
        
        // Update user balance
        await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
        
        // Update item stock (only if it's not infinite stock)
        if (!item.infiniteStock) {
          await storage.updateItem(item.id, { stock: item.stock - quantity });
        }
        
        // Create transaction record
        await storage.createTransaction({
          discordUserId: discordUser.id,
          itemId: item.id,
          quantity: quantity,
          totalPrice: totalPrice
        });
        
        // If there's a Discord role ID associated with the item, give role to user
        if (item.discordRoleId && interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            await member.roles.add(item.discordRoleId);
          } catch (roleError) {
            console.error('Error adding role:', roleError);
            // Continue with the purchase even if role assignment fails
          }
        }
        
        // 選択肢がある場合はオプション選択のステップを追加
        if (item.options && item.options.length > 0) {
          // 選択肢メニューの作成
          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('option_select_slash')
            .setPlaceholder('選択肢を選んでください')
            .addOptions(
              item.options.map(option => ({
                label: option,
                value: option
              }))
            );
          
          const row = new ActionRowBuilder<any>().addComponents(selectMenu);
          
          // 選択肢選択用メッセージを送信
          await interaction.editReply({
            content: `${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン\n\n**オプションを選択してください**:`,
            components: [row]
          });
          
          // DMのコンテンツがない場合は選択メニューのみ表示して完了
          if (!item.content) {
            // 公開メッセージ
            const publicEmbed = new EmbedBuilder()
              .setTitle('商品が購入されました！')
              .setDescription(`${interaction.user.username} が ${item.name} を ${quantity} 個購入しました！`)
              .setColor('#3BA55C');
              
            await interaction.channel?.send({ embeds: [publicEmbed] });
            return;
          }
          
          try {
            // インタラクションフィルターを作成
            const filter = (i: { user: { id: string }; }) => i.user.id === interaction.user.id;
            
            // 15秒待機
            const selected = await interaction.channel?.awaitMessageComponent({ 
              filter, 
              time: 15000 
            });
            
            if (selected && selected.isStringSelectMenu()) {
              const selectedOption = selected.values[0];
              
              // DMを送信
              const dmChannel = await interaction.user.createDM();
              let dmContent = `**${item.name}** の購入ありがとうございます！\n\n`;
              
              // 選択されたオプションを表示
              dmContent += `選択されたオプション: **${selectedOption}**\n\n`;
              dmContent += `ここに購入した商品の内容を記載します:\n\n${item.content}`;
              
              await dmChannel.send({
                content: dmContent
              });
              
              // 選択後のメッセージを更新
              await selected.update({
                content: `${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン\n\n選択されたオプション: **${selectedOption}**\n\n📩 商品の詳細はDMをご確認ください。`,
                components: []
              });
            }
          } catch (error) {
            console.error('Option selection error:', error);
            await interaction.editReply({
              content: `${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン\n\n⚠️ オプション選択がタイムアウトしました。`,
              components: []
            });
          }
        } else {
          // 選択肢がない場合は通常の購入完了処理
          let successMessage = `${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン`;
          
          // DMでコンテンツを送信
          if (item.content) {
            try {
              const dmChannel = await interaction.user.createDM();
              let dmContent = `**${item.name}** の購入ありがとうございます！\n\n`;
              dmContent += `ここに購入した商品の内容を記載します:\n\n${item.content}`;
              
              await dmChannel.send({
                content: dmContent
              });
              
              successMessage += `\n\n📩 商品の詳細はDMをご確認ください。`;
            } catch (error) {
              console.error("Failed to send DM:", error);
              successMessage += `\n\n⚠️ DMの送信に失敗しました。プライバシー設定を確認してください。`;
            }
          }
          
          await interaction.editReply(successMessage);
        }
        
        // Send public message (optional)
        const publicEmbed = new EmbedBuilder()
          .setTitle('商品が購入されました！')
          .setDescription(`${interaction.user.username} が ${item.name} を ${quantity} 個購入しました！`)
          .setColor('#3BA55C');
          
        await interaction.channel?.send({ embeds: [publicEmbed] });
      } catch (error) {
        console.error('Error in buy command:', error);
        await interaction.editReply('購入処理中にエラーが発生しました。');
      }
    },
  };
  
  // Balance command - check user's balance
  const balanceCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_balance')
      .setDescription('残高を確認します'),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Get the user
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (!discordUser) {
          return await interaction.editReply('ユーザー情報が見つかりません。');
        }
        
        // Get bot settings or use defaults
        const guildSettings = await storage.getBotSettings(interaction.guildId || '');
        const currencyName = guildSettings?.currencyName || 'コイン';
        
        // Send balance message
        await interaction.editReply(`現在の残高: ${discordUser.balance} ${currencyName}`);
      } catch (error) {
        console.error('Error in balance command:', error);
        await interaction.editReply('残高の確認中にエラーが発生しました。');
      }
    },
  };
  
  // Admin commands - for managing items
  
  // Add item command
  const addCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_add')
      .setDescription('新しい商品を追加します (管理者のみ)')
      .addStringOption(option => 
        option.setName('name')
          .setDescription('商品名')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('price')
          .setDescription('価格')
          .setRequired(true))
      .addStringOption(option => 
        option.setName('description')
          .setDescription('商品の説明')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('stock')
          .setDescription('在庫数')
          .setRequired(false))
      .addStringOption(option => 
        option.setName('role_id')
          .setDescription('付与するロールID (オプション)')
          .setRequired(false)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const name = interaction.options.getString('name', true);
        const price = interaction.options.getInteger('price', true);
        const description = interaction.options.getString('description', true);
        const stock = interaction.options.getInteger('stock') || 0;
        const roleId = interaction.options.getString('role_id') || null;
        
        // Create the item
        const item = await storage.createItem({
          name,
          description,
          price,
          stock,
          isActive: true,
          discordRoleId: roleId
        });
        
        await interaction.editReply(`商品を追加しました：${item.name} (ID: ${item.id}, 価格: ${item.price} コイン)`);
      } catch (error) {
        console.error('Error in add command:', error);
        await interaction.editReply('商品の追加中にエラーが発生しました。');
      }
    },
  };
  
  // Remove item command
  const removeCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_remove')
      .setDescription('商品を削除します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('削除する商品のID')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Delete the item
        await storage.deleteItem(itemId);
        
        await interaction.editReply(`商品を削除しました：${item.name} (ID: ${item.id})`);
      } catch (error) {
        console.error('Error in remove command:', error);
        await interaction.editReply('商品の削除中にエラーが発生しました。');
      }
    },
  };
  
  // Update price command
  const priceCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_price')
      .setDescription('商品の価格を変更します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('価格を変更する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('new_price')
          .setDescription('新しい価格')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        const newPrice = interaction.options.getInteger('new_price', true);
        
        if (newPrice < 0) {
          return await interaction.editReply('価格は0以上の値を指定してください。');
        }
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Update the item price
        const updatedItem = await storage.updateItem(itemId, { price: newPrice });
        
        await interaction.editReply(`商品の価格を変更しました：${updatedItem?.name} (新価格: ${newPrice} コイン)`);
      } catch (error) {
        console.error('Error in price command:', error);
        await interaction.editReply('価格の変更中にエラーが発生しました。');
      }
    },
  };
  
  // Update stock command
  const stockCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_stock')
      .setDescription('商品の在庫数を設定します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('在庫を変更する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('quantity')
          .setDescription('新しい在庫数')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        const quantity = interaction.options.getInteger('quantity', true);
        
        if (quantity < 0) {
          return await interaction.editReply('在庫数は0以上の値を指定してください。');
        }
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Update the item stock
        const updatedItem = await storage.updateItem(itemId, { stock: quantity });
        
        await interaction.editReply(`商品の在庫数を変更しました：${updatedItem?.name} (新在庫数: ${quantity})`);
      } catch (error) {
        console.error('Error in stock command:', error);
        await interaction.editReply('在庫数の変更中にエラーが発生しました。');
      }
    },
  };
  
  // Register all commands with the client
  const commands = [
    showCommand,
    buyCommand,
    balanceCommand,
    addCommand,
    removeCommand,
    priceCommand,
    stockCommand,
    addCoinsCommand
  ];
  
  // Add each command to the client.commands collection
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
  
  try {
    // APIにコマンドを登録
    console.log('Started refreshing application (/) commands.');
    
    const commandsData = commands.map(command => command.data.toJSON());
    
    // RESTモジュールを使用してDiscord APIと通信
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN || '');
    
    // グローバルコマンドとして登録（すべてのサーバーで利用可能）
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commandsData },
    );
    
    console.log(`Successfully registered ${commands.length} application commands globally.`);
  } catch (error) {
    console.error('Error registering application commands:', error);
  }
  
  console.log(`Registered ${commands.length} vending machine commands`);
}
