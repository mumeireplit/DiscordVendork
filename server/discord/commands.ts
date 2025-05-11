import { Client, SlashCommandBuilder, EmbedBuilder, CommandInteraction, REST, Routes, Collection } from 'discord.js';
import { IStorage } from '../storage';

// Extend Discord.js Client to add commands property
interface BotClient extends Client {
  commands: Collection<string, any>;
}

// Register all commands with the Discord client
export async function registerCommands(client: BotClient) {
  // Show command - displays all items in the vending machine
  const showCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_show')
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
          .setDescription(`以下の商品が販売中です！購入するには \`/vending_buy [商品ID]\` を使用してください`)
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
      .setName('vending_buy')
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
        
        if (item.stock < quantity) {
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
        
        // Update item stock
        await storage.updateItem(item.id, { stock: item.stock - quantity });
        
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
        
        // Send success message
        await interaction.editReply(`${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン`);
        
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
    stockCommand
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
