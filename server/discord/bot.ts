import { Client, GatewayIntentBits, Collection, Events, Message, MessageFlags } from 'discord.js';
import { registerCommands, handleCommand } from './commands';
import { storage } from '../storage';

// Extend Discord.js Client to add commands property
interface BotClient extends Client {
  commands: Collection<string, any>;
}

// Create a Discord client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
}) as BotClient;

// Command collection to store and retrieve commands
client.commands = new Collection();

// Register commands when the client is ready
client.once(Events.ClientReady, async () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  
  // Register the commands
  await registerCommands(client);
});

// Process interaction events (スラッシュコマンドとボタンインタラクション)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // Get or create discord user in our database for any interaction
    const discordId = interaction.user.id;
    let discordUser = await storage.getDiscordUserByDiscordId(discordId);
    
    if (!discordUser) {
      discordUser = await storage.createDiscordUser({
        discordId,
        username: interaction.user.username,
        balance: 0 // Start with 0 coins
      });
    }

    // Handle slash commands
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      
      await command.execute(interaction, storage);
    }
    // The bot will now properly process button interactions through the message collectors
    // that were set up in the commands.ts file
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    // Reply with error if the interaction hasn't been replied to yet
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ 
          content: 'インタラクションの処理中にエラーが発生しました。', 
          flags: MessageFlags.Ephemeral 
        });
      } else {
        await interaction.reply({ 
          content: 'インタラクションの処理中にエラーが発生しました。', 
          flags: MessageFlags.Ephemeral 
        });
      }
    }
  }
});

// Process message events (! プレフィックスコマンド)
client.on(Events.MessageCreate, async (message: Message) => {
  // Ignore bot messages and messages that don't start with !
  if (message.author.bot || !message.content.startsWith('!')) return;
  
  // Extract the command name and arguments
  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  
  if (!commandName) return;
  
  try {
    // Get or create discord user in our database
    const discordId = message.author.id;
    let discordUser = await storage.getDiscordUserByDiscordId(discordId);
    
    if (!discordUser) {
      discordUser = await storage.createDiscordUser({
        discordId,
        username: message.author.username,
        balance: 0 // Start with 0 coins
      });
    }
    
    // Command names that start with "vending_" in slash commands
    // but we want to support just the command name with ! prefix
    // e.g. !show instead of !vending_show
    const fullCommandName = `vending_${commandName}`;
    
    // Handle the command
    await handleCommand(message, commandName, args, storage);
  } catch (error) {
    console.error('Error handling message command:', error);
    await message.reply('コマンドの実行中にエラーが発生しました。');
  }
});

// Initialize the bot with the token from env
export function initBot() {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    console.error('DISCORD_BOT_TOKEN is not defined in environment');
    return;
  }
  
  client.login(token).catch(err => {
    console.error('Failed to login to Discord:', err);
  });
  
  return client;
}

export default client;
