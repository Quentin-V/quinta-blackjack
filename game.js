const Deck = require('./cards.js');
const Player = require('./player.js');

class BlackJack {
	constructor(message) {
		this.players = [];
		this.choosing = 0;
		this.dealing = false;
		this.addPlayer(message.author);
		this.deck = new Deck(6);
		this.channel = message.channel;
		this.message = message;
		this.bank = [];
		this.bankReveal = false;
		this.changeShoe = false;
		this.wait = false;
	}

	deal() {
		this.bankReveal = false;
		this.dealing = true;
		if(this.changeShoe) {this.deck.shuffle(); this.changeShoe = false;} // Reshuffles the deck
		if(this.deck.c.length < (6*52)/2) { // If we exceded half of the shoe, change it on the next deal
			this.changeShoe = true;
			this.channel.send(`The shoe will be changed on the next deal.`);
		}
		for(let i = 0; i < 2; ++i) { // Deal 2 cards to each player
			this.players.forEach(p => {
				p.cards.push(this.deck.c.shift());
			});
			this.bank.push(this.deck.c.shift()); // Deal cards to the bank
		}
		this.players.forEach(p => p.calcVal()) // Calculates the value of each player's hand

		this.sendMessage().then(collector => {
			if(Deck.getVal(this.bank[0]) === 'A') this.insurance(collector);
		});

	}

	insurance(thisDealCollector) {
		this.wait = true;
		this.channel.send(`The bank has an Ace, would you like to take the insurance ?\n(You have 20 seconds to choose)`).then(m => {
			m.react('✅');
			m.react('❎');
			let filter = (r, u) => !u.bot;
			let insuranceColl = m.createReactionCollector(filter, {time:20_000});
			let insured = [];
			let ignore = [];
			insuranceColl.on('collect', (r, u) => {
				r.users.remove(u);
				if(r.emoji.name === '❎') return;
				let playerIns = this.players.find(p => p.user.id === u.id);
				if(playerIns.balance >= playerIns.bet / 2) { // If the player can pay insurance
					playerIns.balance -= playerIns.bet / 2; // Removes insurance cost from the player's balance
					insured.push(playerIns);
					m.edit(m.content + `\n${playerIns.user} took the insurance.`);
				}else {
					if(!ignore.includes(playerIns)) {
						this.channel.send(`${playerIns.user}, you can not afford the insurance.`).then(m => {
							setTimeout(() => {
								m.delete();
							}, 4_000);
						});
						ignore.push(playerIns); // Add the player to the ignore list
					}
				}
			});
			insuranceColl.on('end', (c, r) => {
				m.reactions.removeAll();
				if(Deck.getVal(this.bank[1]) === 10) { // The bank has a blackjack
					m.edit(`The bank has a BlackJack, you lose your bet if you're not insured.`); // Inform players
					thisDealCollector.stop('bankBj');
				}else {
					m.edit('The bank does not have a BlackJack'); // Inform players
				}
				setTimeout(() => { // Delete the message after 5 secs
					m.delete();
				}, 5_000);
				this.wait = false; // Reset wait to false for players to be able to play
			});
		});
	}

	bankDraw() {
		let bj = this;
		return new Promise(function(resolve, reject) {
			setTimeout(function () { // Suspens timeout
				bj.bankReveal = true; // Reveal on for toString to show bank cards
				bj.update(); // Show the first card to reveal

				let bankVal = bj.calcVal(); // Calculates the value of the bank

				let revealInterval = setInterval(() => {
					if((isNaN(bankVal) && parseInt(bankVal.split('/')[1], 10) < 17) || bankVal < 17) { // If the bank value is under 17
						bj.bank.push(bj.deck.c.shift()); // The bank picks a card
						bankVal = bj.calcVal(); // Recalculates the bank value
						bj.update(); // Updates the message
					}else { // If the bank is 17 or over
						clearInterval(revealInterval); // Clear the interval
						let win = [];
						let lose = [];
						let push = [];
						if(bankVal > 21) {
							bj.players.forEach(p => {
								if(p.val <= 21) {
									p.balance += 2 * p.bet;
									win.push(p);
								}else {
									lose.push(p);
								}
							});
						}else {
							bj.players.forEach(p => {
								if(p.val > bankVal) {
									p.balance += 2 * p.bet; // Win
									win.push(p);
								}
								else if(p.val == bankVal) {
									p.balance += p.bet; // Push
									push.push(p);
								}else {
									lose.push(p); // If lose, just add the player to lose array
								}
							});
						}
						this.editWin(this.message, win, lose, push);
						setTimeout(() => {
							resolve();
						}, 3000);
					}
				}, 2_500);
			}, 3_000);
		});
	}

	calcVal() {
		let val = 0; // Reset val
		let ace = false; // Set ace

		this.bank.forEach(c => { // To check each card
			if(Deck.getVal(c) == 'A') { // If the card is an ace
				if(ace) // It is not the first ace of the player's hand
					val += 1; // Add 1 to val since 2 aces can't be 1/11, do not change ace boolean to still get a 1/11 ace
				ace = true; // Sets ace to true to know that there's an ace in the player's hand
			}else {
				val += Deck.getVal(c); // Add the value of the card to the hand value
			}
		});

		if(ace) // If the player has an ace
			val = val+11 > 21 ? val+1 : `${val+1}/${val+11}`; // Displays both values or only the low one if the high one is bust

		if(val === `11/21` && this.bank.length === 2) { // If blackjack or bust or 21, stand the player
			if(val === `11/21` && this.bank.length === 2) // If the player has a BlackJack
				return 21; // Change value
		}
		return val;
	}

	sendMessage() {
		let bj = this;
		return new Promise(function(resolve, reject) {
			bj.channel.send(bj + `\n`).then(m => {
				bj.message = m;
				m.react('%E2%A4%B5%EF%B8%8F'); // %E2%A4%B5%EF%B8%8F HIT
				m.react('%E2%8F%B9%EF%B8%8F'); // %E2%8F%B9%EF%B8%8F Stop
				m.react('2%EF%B8%8F%E2%83%A3'); // 2%EF%B8%8F%E2%83%A3 DOUBLE
				m.react('%E2%86%94%EF%B8%8F'); // %E2%86%94%EF%B8%8F SPLIT
				let filter = (r, u) => !u.bot && bj.players.find(p => p.user.id === u.id) !== null;
				let collector = m.createReactionCollector(filter);
				bj.initCollector(collector);
				resolve(collector);
			});
		});
	}

	initCollector(collector) {
		collector.on('collect', (r, u) => this.handleReactions(r, u, collector));
		collector.on('end', (c, r) => {
			this.message.reactions.removeAll(); // Removes all the reactions form the message
			this.bankDraw().then(() => { // Draw for the bank then
				this.players.forEach(p => { // Reset the cards and bet of each player
					p.bet = 0;
					p.cards = [];
				});
				this.dealing = false; // Reset dealing
				this.bank = []; // Reset the bank cards
				this.choosing = 0; // Reset choosing index
			});
		});
	}

	handleReactions(r, u, collector) {
		r.users.remove(u);
		let currentPlayer = this.players.find(p => p.user.id === u.id);
		if(this.wait) return;
		if(u.id !== currentPlayer.user.id) return;
		if(r.emoji.identifier === '%E2%A4%B5%EF%B8%8F') { // Hit
			currentPlayer.cards.push(this.deck.c.shift());
			currentPlayer.calcVal(); // Recalculate the value of the player's hand
			if(currentPlayer.stand)  // If the player has 21 or has busted
				++this.choosing; // Next player's turn
		}else if(r.emoji.identifier === '%E2%8F%B9%EF%B8%8F') { // Stand
			++this.choosing;
		}else if(r.emoji.identifier === '2%EF%B8%8F%E2%83%A3') { // Double down

		}else if(r.emoji.identifier === '%E2%86%94%EF%B8%8F') { // Split

		}
		this.update(); // Updates the message
		if(this.choosing >= this.players.length) collector.stop('dealEnd'); // If the last player has chosen his action, stop the collector
	}

	update() {
		this.message.edit(this + ``);
	}

	addPlayer(user) {
		this.players.push(new Player(user));
	}

	bet(msg) {
		if(isNaN(parseInt(msg.content.split(' ')[1], 10))) {
			msg.reply('Erreur de syntaxe dans le message, `bet MONTANT`').then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
			return;
		}
		let amount = parseInt(msg.content.split(' ')[1], 10);
		let better = this.players.find(p => p.user.id === msg.author.id);
		if(better.balance < amount) {
			msg.reply('Tu n\'as pas assez d\argent sur ta balance').then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
		}else {
			better.bet = amount;
			better.balance -= amount;
		}
	}

	toString() {
		let ret = `💸 💰 Bank 🏦 💸 | ${this.bank[0]}${this.bankReveal ? ' | ' + this.bank.slice(1).join(' | ') : ''} (${this.calcVal()})\n`; // Bank cards
		this.players.forEach(p => {
			// ☠️ 🔴 🟢
			let turnemoji = this.players.indexOf(p) === this.choosing ? '🟢' : '🔴'; // Emoji of if it's the player turn to choose
			let val = p.calcVal();
			if(val > 21) turnemoji = '☠️';
			ret += `${turnemoji} ${p.user} | ${p} (${val})\n`; // Add a line for the player
		});
		return ret; // Returns the string builded
	}
}

module.exports = BlackJack;
