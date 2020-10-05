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
		if(isNaN(parseInt(message.content.split(' ')[1], 10))) {
			message.reply('Erreur de syntaxe dans le message, `bet MONTANT`').then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 4000);
			});
			return;
		}
		let amount = parseInt(message.content.split(' ')[1], 10);
		let better = game.players.find(p => p.user.id === message.author.id);
		if(better.balance < amount) {
			message.reply('Tu n\'as pas assez d\argent sur ta balance').then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 4000);
			});
			return;
		}
		game.bet(better, amount);
	}

	if(message.content === 'deal' && !game.dealing) {
		message.delete();
		game.deal();
	}
});

bot.login(credentials.token);
