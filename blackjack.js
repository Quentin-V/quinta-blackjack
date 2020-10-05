const Player = require('./player.js');
const Deck = require('./cards.js');
const Discord = require('discord.js');
const BlackJack = require('./game.js');
const credentials = require('./credentials.js');

const bot = new Discord.Client();

bot.on('ready', () => {
	console.log(`Connected as ${bot.user.tag}`);
})
var game = null;
bot.on('message', message => {

	if(message.author.bot) return;

	if(message.content === 'bjstart' && game === null) {
		message.delete();
		game = new BlackJack(message);
	}

	if(message.content.startsWith('bet') && !game.dealing) {
		message.delete();
		game.bet(message);
	}

	if(message.content === 'deal' && !game.dealing) {
		message.delete();
		game.deal();
	}
});

bot.login(credentials.token);
