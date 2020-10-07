const Deck = require('./cards.js');
const Player = require('./player.js');
const Discord = require('discord.js');

const DEBUG = true;
const BANK_CARDS = ['Ten :spades:', 'Ten :hearts:'];
const PLAYER_CARDS = ['Ace :diamonds:', 'Nine :spades:'];

class BlackJack {
	constructor(message) {
		this.allPlayers = Player.loadAll();
		this.players = [];
		this.choosing = 0;
		this.dealing = false;
		this.deck = new Deck(6);
		this.channel = message.channel;
		this.message = message;
		this.betters = null;
		this.bank = [];
		this.bankReveal = false;
		this.changeShoe = false;
		this.wait = false;
	}

	deal() {
		if(this.betters === null || this.players.length === 0) return;
		this.betters.delete();
		this.betters = null;

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

		if(DEBUG) {
			this.bank = BANK_CARDS;
			this.players[0].cards = PLAYER_CARDS;
		}

		this.players.forEach(p => { // Calculates the value of each player's hand
			let v = p.calcVal();
			if (isNaN(v) && v.includes('BlackJack')) {
				p.stand = true;
				++this.choosing;
			}
		});

		this.sendMessage().then(collector => {
			if(Deck.getVal(this.bank[0]) === 'A') this.insurance(collector);
			else if(this.choosing >= this.players.length) collector.stop('dealEnd');
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
			let notInsured = [];
			let ignore = [];
			let hasChosen = 0;
			insuranceColl.on('collect', (r, u) => {
				r.users.remove(u);
				let playerIns = this.players.find(p => p.user.id === u.id);
				if(insured.includes(playerIns) || notInsured.includes(playerIns) || (r.emoji.name !== '✅' && r.emoji.name !== '❎')) return;
				++hasChosen;
				if(r.emoji.name === '✅') {
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
				}else if(r.emoji.name === '❎') {
					++hasChosen;
				}
				if(hasChosen >= this.players.length) {
					setTimeout(() => {
						insuranceColl.stop('everybodyChose');
					}, 1000);
				}
			});
			insuranceColl.on('end', (c, r) => {
				m.reactions.removeAll();
				if(Deck.getVal(this.bank[1]) === 10) { // The bank has a blackjack
					m.edit(`The bank has a BlackJack, you lose your bet if you're not insured.`); // Inform players
					this.bankBj(insured);
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

						bj.players.forEach(p => {
							if(isNaN(p.val) && !p.val.includes('BlackJack')) p.val =  parseInt(p.val.split('/')[1], 10);
							if(isNaN(p.val) && p.val.includes('BlackJack')) {
								p.balance += 2.5 * p.bet;
								win.push(p);
							}else if(bankVal > 21) { // Bank busted
									if(p.val <= 21) { // If the player did not bust
										p.balance += 2 * p.bet;
										win.push(p);
									}else { // The player busted
										lose.push(p);
									}
							}else { // Bank did not bust
									if(p.val > bankVal && p.val <= 21) {
										p.balance += 2 * p.bet; // Normal win
										win.push(p);
									}else if(p.val === bankVal && p.val <= 21) {
										p.balance += p.bet; // Push
										push.push(p);
									}else {
										lose.push(p); // If lose, just add the player to lose array
									}
							}
						});

						bj.editWin(win, lose, push, bankVal).then(msg => {
							setTimeout(() => {
								resolve(msg);
							}, 3000);
						});
					}
				}, 2_500);
			}, 3_000);
		});
	}

	editWin(win, lose, push, bankVal) {
		let bj = this;
		return new Promise(function(resolve, reject) {
			let mess = `💸 💰 Bank 🏦 💸 | ${bj.bank.join(' | ')} (${bankVal > 21 ? bankVal +  ` BUST` : bankVal})\n`;
			bj.players.forEach(p => {
				if(p.bet > 0) {
					if(win.includes(p)) {
						if(isNaN(p.val) && p.val.includes('BlackJack'))
							mess += `💰 | ${p.user} wins ${p.bet*1.5} (BlackJack)\n`;
						else
							mess += `💰 | ${p.user} wins ${p.bet}\n`;
					}else if(lose.includes(p)) {
						mess += `☠️ | ${p.user} loses his bet of ${p.bet}\n`;
					}else if(push.includes(p)){
						mess += `↕️ | ${p.user} push and get their bet back (${p.bet})\n`;
					}else {
						console.log(`Error, ${p.user.tag} not found in win, lose or push`);
					}
				}
			})
			bj.message.edit(mess).then(msg => resolve(msg));
		});
	}

	calcVal() {
		let val = 0; // Reset val
		let ace = false; // Set ace

		if(this.bankReveal) {
			this.bank.forEach(c => { // To check each card
				if(Deck.getVal(c) == 'A') { // If the card is an ace
					if(ace) // It is not the first ace of the player's hand
						val += 1; // Add 1 to val since 2 aces can't be 1/11, do not change ace boolean to still get a 1/11 ace
					ace = true; // Sets ace to true to know that there's an ace in the player's hand
				}else {
					val += Deck.getVal(c); // Add the value of the card to the hand value
				}
			});
		}else {
			if(Deck.getVal(this.bank[0]) == 'A') { // If the card is an ace
				return `1/11`; // Sets ace to true to know that there's an ace in the player's hand
			}else {
				return Deck.getVal(this.bank[0]); // Add the value of the card to the hand value
			}
		}


		if(ace && val+11 >= 17 && val+11 <= 21) return val+11 // If val+11 between 17 and 21, stop
		if(ace) // If the player has an ace {
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
			if(r === 'dealEnd') {
				this.bankDraw().then(msg => { // Draw for the bank then
					this.reset();
				});
			}else if(r === 'bankBj') {
				this.reset();
			}
		});
	}

	reset() {
		this.dealing = false; // Reset dealing
		this.bank = []; // Reset the bank cards
		this.choosing = 0; // Reset choosing index
		this.players.forEach(p => { // Reset the cards and bet of each player
			p.bet = 0;
			p.val = 0;
			p.splitVal = 0;
			p.cards = [];
			p.stand = false;
			p.splitted = false;
			p.splitStand = false;
		});
		this.players = []; // Reset players
		Player.saveAll(this.allPlayers);
		setTimeout(() => {
			this.message.delete();
		}, 4_000);
	}

	bankBj(insured) {
		let mess = `💸 💰 Bank 🏦 💸 | ${this.bank.join(' | ')} (BlackJack)\n`;
		this.players.forEach(p => {
			if(insured.includes(p)) {
				p.balance += p.bet + p.bet/2 // Returns the bet and the insurance
				mess += `🦺 | ${p.user} | Bet & Insurance returned ${p.bet + p.bet/2}\n`;
			}else {
				mess += `☠️ | ${p.user} | Bet lost (${p.bet})`;
			}
		});
		this.channel.send(mess).then(m => {
			setTimeout(() => {
				m.delete();
			}, 5_000);
		});
	}

	handleReactions(r, u, collector) {
		r.users.remove(u);
		let currentPlayer = this.players[this.choosing];
		if(currentPlayer.user.id !== u.id) return;
		if(this.wait) return;
		if(u.id !== currentPlayer.user.id) return;
		if(r.emoji.identifier === '%E2%A4%B5%EF%B8%8F') { // Hit
			if(!currentPlayer.stand) {
				currentPlayer.cards.push(this.deck.c.shift());
				currentPlayer.calcVal(); // Recalculate the value of the player's hand
				if(currentPlayer.stand)  // If the player has 21 or has busted
					++this.choosing; // Next player's turn
			}else if(currentPlayer.stand && currentPlayer.splitted) {
				currentPlayer.splitCards.push(this.deck.c.shift());
				currentPlayer.calcVal(currentPlayer.splitCards, currentPlayer.splitStand);
				if(currentPlayer.splitStand)
					++this.choosing;
			}
		}else if(r.emoji.identifier === '%E2%8F%B9%EF%B8%8F') { // Stand
			if(!currentPlayer.splitted || (currentPlayer.splitted && !currentPlayer.stand)) {
				currentPlayer.stand = true;
			}else if(currentPlayer.splitted && currentPlayer.stand) {
				currentPlayer.splitStand = true;
			}
			//currentPlayer.stand = true;
			++this.choosing;
		}else if(r.emoji.identifier === '2%EF%B8%8F%E2%83%A3') { // Double down
			this.double(currentPlayer);
		}else if(r.emoji.identifier === '%E2%86%94%EF%B8%8F') { // Split
			if(!currentPlayer.splitted && currentPlayer.cards.length === 2 && Deck.getVal(currentPlayer.cards[0]) === Deck.getVal(currentPlayer.cards[1]))
			this.split(currentPlayer);
		}
		this.update(); // Updates the message
		if(this.choosing >= this.players.length) collector.stop('dealEnd'); // If the last player has chosen his action, stop the collector
	}

	double(player) {
		if(player.cards.length !== 2) { // If player has already picked a card
			this.channel.send(`${player.user}, you can not double since you already picked a card.`).then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 5_000);
			});
			return;
		}
		if(player.balance < player.bet) { // If th eplayer does not have enough balance
			this.channel.send(`${player.user}, you can not afford to double.`).then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 5_000);
			});
			return;
		}
		player.cards.push(this.deck.c.shift()) // Pick one card
		player.bet *= 2;
		player.balance -= player.bet;
		player.stand = true; // Stand the player
		++this.choosing; // Increment choosing player
		this.update(); // Updates the message
	}

	split(player) {
		if(player.balance < player.bet) {
			this.channel.send(`${player.user}, you can not afford to split.`).then(m => {
				setTimeout(function () {
					m.delete();
				}, 3_000);
			});
			return;
		}
		player.balance -= player.bet;
		let indexPlayer = this.players.indexOf(player);
		this.players.splice(indexPlayer + 1, 0, player) // Duplicate the player
		player.splitCards = [player.cards[1], this.deck.c.shift()]; // Set the 2nd card and a new card for the splitted hand
		player.cards = [player.cards[0], this.deck.c.shift()]; // Keeps only one card and pick a new card for the first array
		player.splitted = true;
	}

	update() {
		this.message.edit(this + ``);
	}

	bet(msg) {
		if(isNaN(parseInt(msg.content.split(' ')[1], 10))) { // If command syntax is incorrect
			msg.reply('Error in the message syntax, `bet AMOUNT`').then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
			return;
		}
		let amount = parseInt(msg.content.split(' ')[1], 10);
		let better = this.allPlayers.find(p => p.user.id === msg.author.id);
		if(better === undefined) {
			this.allPlayers.push(new Player(msg.author));
			better = this.allPlayers.find(p => p.user.id === msg.author.id);
		}
		better.user = msg.author; // Resets the user value of the better with a real discord user object
		if(better.balance < amount) { // User can't afford
			msg.reply(`you can't afford this bet`).then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
		}else {
			this.players.push(better);
			better.bet = amount;
			better.balance -= amount;
			this.updateBetters();
		}
	}

	updateBetters() {
		let bets = `Bets : \n`;
		this.players.forEach(p => {
			bets += `\t${p.user} | ${p.bet}\n`;
		});
		if(this.betters !== null) {
			this.betters.edit(bets);
		}else {
 			this.channel.send(bets).then(betters => this.betters = betters);
		}
	}

	cancelBet(user) {
		this.players = this.players.filter(p => p.user.id !== user.id);
		this.updateBetters();
	}

	getBalance(user) {
		let player = this.allPlayers.find(p => p.user.id === user.id);
		if(player !== undefined) {
			return `Your current balance is ${player.balance}`;
		}else {
			return `Player not found in memory, you'll start with 10 000, to place a bat, type bet in the game channel`;
		}
	}

	toString() {
		let bankVal = this.calcVal();
		let ret = `💸 💰 Bank 🏦 💸 | ${this.bank[0]}${this.bankReveal ? ' | ' + this.bank.slice(1).join(' | ') : ''} (${bankVal > 21 ? bankVal +  ` BUST` : bankVal})\n`; // Bank cards
		let alreadyStringed = [];
		this.players.forEach(p => {
			// ☠️ 🔴 🟢
			if(p.splitted && alreadyStringed.includes(p)) {
				let turnemoji = p.stand && !p.splitStand ? '🟢' : '🔴'; // Emoji of if it's the player turn to choose
				let val = p.calcVal(p.splitCards, p.splitStand);
				if(val > 21) turnemoji = '☠️';
				ret += `${turnemoji} ${p.user} | ${p.splitCardsToString()} (${val > 21 ? val + ` BUST` : val})\n`; // Add a line for the player
			}else {
				let turnemoji = this.players.indexOf(p) === this.choosing ? '🟢' : '🔴'; // Emoji of if it's the player turn to choose
				let val = p.calcVal();
				if(val > 21) turnemoji = '☠️';
				ret += `${turnemoji} ${p.user} | ${p} (${val > 21 ? val + ` BUST` : val})\n`; // Add a line for the player
				if(p.splitted) alreadyStringed.push(p);
			}
		});
		return ret; // Returns the string builded
	}
}

module.exports = BlackJack;
