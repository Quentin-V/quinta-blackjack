const Discord = require('discord.js');
const BlackJack = require('./game.js');
const credentials = require('./credentials.js');

const bot = new Discord.Client();

bot.on('ready', () => {
	console.log(`Connected as ${bot.user.tag}`);
})

var games = []; // Initiates an array for all games if there are

bot.on('message', message => {

	if(message.author.bot) return; // If bot, return

	let game = null;
	games.forEach(g => { // Try to find the game where the message has been sent
		if(g.channel.id === message.channel.id) {
			isInGameChannel = true;
			game = g;
		}
	});

	if(message.content === 'bjstart' && game === null && message.channel.type === 'text') { // Creates a new game if no one was found
		message.delete();
		games.push(new BlackJack(message));
		console.log(`Started new game in channel : ${message.channel.name}`);
	}

	if(game === null) return; // If no new game has been found,

	message.delete(); // Deletes the message

	console.log(`Received ${message.content} from ${message.author.tag} (${message.author.id})`);

	if(message.content.startsWith('bet')) { // Place a bet
		game.bet(message);
	}

	if(message.content === 'cancelbet') { // Cancel a bet
		game.cancelBet(message.author);
	}

	if(message.content === 'deal') { // Start dealing
		game.deal();
	}

	if(message.content === 'bal') { // Displays the balance of the user sending the message
		if(message.channel.type === 'text') message.delete();
		message.reply(game.getBalance(message.author)).then(m => {
			setTimeout(() => { // Deletes the message after 2 minutes
				m.delete()
			}, 120000);
		});
	}

	if(message.content.startsWith('baltop')) { // Displays the 10 first players by balance amount
		let sortedPlayers = game.allPlayers.slice().sort((p1, p2) => p2.balance - p1.balance);
		sortedPlayers.splice(10);
		let msgText = `Top 10 players :\n`;
		sortedPlayers.forEach(p => msgText += `\t<@${p.user.id}> | ${p.balance}💰\n`);
		message.channel.send(msgText).then(m => {
			setTimeout(() => { // Deletes the message after 2 minutes
				m.delete()
			}, 120000);
		});
	}

	// Admin command to give/set balance for a player
	if(message.author.id === '184331142286147584' && (message.content.startsWith('give') || message.content.startsWith('set'))) {
		let amount = parseInt(message.content.split(' ')[2]);
		let user = message.mentions.users.array()[0];
		let player = game.allPlayers.find(p => p.user.id === user.id);
		player.balance = message.content.startsWith('give') ? player.balance + amount : amount;
		player.save();
	}

});

bot.login(credentials.token); // Logs the bot in
