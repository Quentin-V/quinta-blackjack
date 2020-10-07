const Player = require('./player.js');
const Deck = require('./cards.js');
const Discord = require('discord.js');
const BlackJack = require('./game.js');
const credentials = require('./credentials.js');

const bot = new Discord.Client();

bot.on('ready', () => {
	console.log(`Connected as ${bot.user.tag}`);
})
var games = [];
bot.on('message', message => {

	if(message.author.bot) return;

	let isInGameChannel = false;
	let game = null;
	games.forEach(g => {
		if(g.channel.id === message.channel.id) {
			isInGameChannel = true;
			game = g;
		}
	});

	if(message.content === 'bjstart' && game === null) {
		message.delete();
		games.push(new BlackJack(message));
	}

	if(game === null) return;

	if(message.content === 'bal') {
		if(message.channel.type === 'text') message.delete();
		message.reply(game.getBalance(message.author));
		return;
	}

	if(!isInGameChannel) return;

	message.delete();

	if(message.content.startsWith('bet') && !game.dealing) {
		game.bet(message);
	}

	if(message.content === 'deal' && !game.dealing) {
		game.deal();
	}

	if(message.content === 'cancelbet' && !game.dealing) {
		game.cancelBet(message.author);
	}
});

bot.login(credentials.token);
