import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { registerCommands } from './commands';
import { storage } from '../storage';

// Create a Discord client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Command collection to store and retrieve commands
client.commands = new Collection();

// Register commands when the client is ready
client.once(Events.ClientReady, async () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  
  // Register the commands
  await registerCommands(client);
});

// Process interaction events
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    // Check if command is vending related
    if (interaction.commandName.startsWith('vending')) {
      // Get or create discord user in our database
      const discordId = interaction.user.id;
      let discordUser = await storage.getDiscordUserByDiscordId(discordId);
      
      if (!discordUser) {
        discordUser = await storage.createDiscordUser({
          discordId,
          username: interaction.user.username,
          balance: 1000 // Start with 1000 coins
        });
      }
    }
    
    await command.execute(interaction, storage);
  } catch (error) {
    console.error(error);
    
    // Reply with error if the interaction hasn't been replied to yet
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ 
        content: 'コマンドの実行中にエラーが発生しました。', 
        ephemeral: true 
      });
    } else {
      await interaction.reply({ 
        content: 'コマンドの実行中にエラーが発生しました。', 
        ephemeral: true 
      });
    }
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
