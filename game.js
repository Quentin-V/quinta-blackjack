const Deck = require('./cards.js');
const Player = require('./player.js');
const Discord = require('discord.js');

const DEBUG = false;
const BANK_CARDS = [];
const PLAYER_CARDS = [];

class BlackJack {
	constructor(message) {
		this.allPlayers = Player.loadAll(); // The array containing all known players
		this.betters = null; // The betters message shown before the deal
		this.bank = []; // The bank cards
		this.players = []; // The active players of the deal
		this.choosing = 0; // The index of the player choosing their action

		this.deck = new Deck(6); // The deck of the game

		this.channel = message.channel; // The discord cahnnel of the game
		this.message = message; // The message of the current deal

		this.dealing = false; // If there is a deal in progress
		this.wait = false; // Idk I don't remember
		this.bankReveal = false; // If the bank cards should be displayed in the message
		this.changeShoe = false; // If the deck has to be changed on next deal
	}

	/***********************************/
	/***********  Betting  *************/
	/***********************************/

	bet(msg) { // Place a bet
		if(this.dealing) return;
		if(isNaN(parseInt(msg.content.split(' ')[1], 10))) { // If command syntax is incorrect
			msg.reply('Error in the message syntax, `bet AMOUNT`').then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
			return;
		}
		let amount = parseInt(msg.content.split(' ')[1], 10); // Get the amount of the bet
		if(amount < 0 || amount % 100 !== 0) { // Incorrect bet amount
			msg.reply('your bet must be a positive integer and a multiple of 100').then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
			return;
		}

		let alreadyBetting = false;
		this.players.some(p => { // Will check if a player is already in the betters list (this.players)
			if(p.user.id === msg.author.id) {
				alreadyBetting = true;
				return true;
			}
			return false;
		})
		if(alreadyBetting) return; // If the player already has a bet

		let better = this.allPlayers.find(p => p.user.id === msg.author.id); // Finds the player who wants to bet
		if(better === undefined) { // If the player is not found
			better = new Player(msg.author); // Creates the player
			this.allPlayers.push(better);  // Adds the new player to the playerlist
		}else { // If the player has been retrieved from the file
			if(!(better.user instanceof Discord.User)) // Checks if the player user is a real user instance, if not...
				better.user = msg.author; // Sets the user value of the better with a real discord user object
		}
		if(better.balance < amount) { // User can't afford
			msg.reply(`you can't afford this bet`).then(m => {
				setTimeout(() => {
					m.delete();
				}, 4000);
			});
		}else { // Betting
			this.players.push(better); // Adding the better to the current player list
			better.bet = amount; // Setting the player's bet value
			better.balance -= amount; // Removing the bet from the balance of the user
			this.updateBetters(); // Update the message with the betters
			console.log(`${msg.author.tag} (${msg.author.id}) placed a bet of ${amount} | New balance : ${better.balance}`);
		}
	}

	cancelBet(user) { // Removes a bet from a player
		if(this.dealing) return;
		let toRemove = this.players.find(p => p.user.id === user.id);
		if(toRemove === null) return;
		toRemove.balance += toRemove.bet; // Refunding the bet
		toRemove.bet = 0; // Resetting the bet variable
		this.players = this.players.filter(p => p.user.id !== user.id); // Filters the players to remove the user
		this.updateBetters();
		console.log(`${user.tag} (${user.id}) removed their bet if they had one`);
	}

	updateBetters() { // Updates the message with the betters
		let bets = `Bets (Dealing in 15 seconds) : \n`;
		this.players.forEach(p => {
			bets += `\t${p.user} | ${p.bet}\n`;
		});
		if(this.betters !== null) { // If the message exists
			if(this.players.length === 0) { // Delete betters cause no more players are betting
				this.betters.delete();
				this.betters = null;
			}else { // Edit the betters message
				this.betters.edit(bets); // Edit the message
			}
		}else { // Sends a new message and creates before dealing interval
 			this.channel.send(bets).then(betters => {
				this.betters = betters
				setTimeout(() => {
					if(this.dealing) return;
					this.betters.edit(this.betters.content.replace(/[0-9]{2}/, '10'));
					setTimeout(() => {
						if(this.dealing) return;
						this.betters.edit(this.betters.content.replace(/[0-9]{2}/, '5'));
						setTimeout(() => {
							if(this.dealing) return;
							this.deal();
						}, 5000);
					}, 5000);
				}, 5000);
			});
		}
	}


	/***********************************/
	/*****  Dealing & Messages  ********/
	/***********************************/

	deal() { // To start the dealing process
		if(this.dealing) return;
		console.log(`Starting to deal`);
		if(this.betters === null || this.players.length === 0) return; // If no one is betting
		this.betters.delete(); // Deletes the betters message
		this.dealing = true; // Set dealing to true to prevent anything happening during the deal

		if(this.changeShoe) {this.deck.shuffle(); this.changeShoe = false;} // Reshuffles the deck if needed

		if(this.deck.c.length < (6*52)/2) { // If we exceded half of the shoe, change it on the next deal
			this.changeShoe = true;
			this.channel.send(`The shoe will be changed on the next deal.`).then(m => { // Inform players and deletes the message after 5s
				setTimeout(() => {
					m.delete()
				}, 5000);
			});
		}
		for(let i = 0; i < 2; ++i) { // Deal 2 cards to each player
			this.players.forEach(p => { // To recreate a lifelike deal
				p.cards.push(this.deck.c.shift());
			});
			this.bank.push(this.deck.c.shift()); // Deal cards to the bank
		}

		if(DEBUG) { // If debug is on, sets the cards of the bank and the player to those set in the begining
			this.bank = BANK_CARDS;
			this.players[0].cards = PLAYER_CARDS;
		}

		this.players.forEach(p => { // Calculates the value of each player's hand
			let v = p.calcVal();
			if (isNaN(v) && v.includes('BlackJack')) { // If the player has a Bj
				p.stand = true; // Stand the player
			}
		});
		this.players.some(p => { // Skip the first players if already standing
			if(!p.stand) return true;
			++this.choosing;
			return false;
		})

		this.sendMessage().then(collector => { // Sends the message then
			if(Deck.getVal(this.bank[0]) === 'A') this.insurance(collector); // If the bank has an Ace upcard, toggle the insurance
			else if(this.choosing >= this.players.length) collector.stop('dealEnd'); // Otherwise, end the deal only if it's already over
		});
	}

	sendMessage() { // To send the principal message of the deal
		let bj = this; // Initiates a variable to use it in the promise
		return new Promise((resolve, reject) => {
			bj.channel.send(bj + `\n`).then(m => { // Sends the message then...
				bj.message = m; // Sets the game message to the sent message
				m.react('%E2%A4%B5%EF%B8%8F'); // React HIT :arrow_heading_down:
				m.react('%E2%8F%B9%EF%B8%8F'); // React STAND :stop_button:
				m.react('2%EF%B8%8F%E2%83%A3'); // React DOUBLE :two:
				m.react('%E2%86%94%EF%B8%8F'); // React SPLIT :left_right_arrow:
				let filter = (r, u) => !u.bot; // Ignore bot reactions
				let collector = m.createReactionCollector(filter); // Creates the collector
				bj.initCollector(collector); // Initiates the collector metohds
				resolve(collector); // Resolve the promise
			});
		});
	}

	initCollector(collector) { // To initiate the collector behaviour
		collector.on('collect', (r, u) => this.handleReactions(r, u, collector));
		collector.on('end', (c, r) => {
			this.message.reactions.removeAll(); // Removes all the reactions form the message
			if(r === 'dealEnd') {
				this.bankDraw().then(msg => { // Draw for the bank then
					this.reset();
				});
			}else if(r === 'bankBj') { // If end on bank bj, just resets as already is already done in other methods
				this.reset();
			}
		});
	}

	handleReactions(r, u, collector) { // Handle the reactions from the players
		r.users.remove(u); // Removes the reaction
		let currentPlayer = this.players[this.choosing]; // Declare the current player
		if(currentPlayer.user.id !== u.id) return; // If the reactor is not the current player returns
		if(this.wait) return; // If have to wait (insurance)
		if(r.emoji.identifier === '%E2%A4%B5%EF%B8%8F') { // Hit
			if(!currentPlayer.stand) { // If the player is not standing (needed in case of a split)
				currentPlayer.cards.push(this.deck.c.shift()); // Adds a card to the player hand
				currentPlayer.calcVal(); // Recalculate the value of the player's hand
				if(currentPlayer.val > 21) { // If the player busted
					currentPlayer.stand = true; // Stand the player
				}
			}else if(currentPlayer.stand && currentPlayer.splitted) { // Second hand of a split
				currentPlayer.splitCards.push(this.deck.c.shift()); // Adds a card to the second hand
				currentPlayer.calcVal(currentPlayer.splitCards, currentPlayer.splitStand); // Recalculates splitval
				if(currentPlayer.splitVal > 21) { // If busted
					currentPlayer.splitStand = true; // stand
				}
			}
		}else if(r.emoji.identifier === '%E2%8F%B9%EF%B8%8F') { // Stand
			if(!currentPlayer.splitted || (currentPlayer.splitted && !currentPlayer.stand)) {
				currentPlayer.stand = true;
			}else if(currentPlayer.splitted && currentPlayer.stand) {
				currentPlayer.splitStand = true;
			}
		}else if(r.emoji.identifier === '2%EF%B8%8F%E2%83%A3') { // Double down
			this.double(currentPlayer);
		}else if(r.emoji.identifier === '%E2%86%94%EF%B8%8F') { // Split
			// If the player has only 2 card and they have the same value
			if(!currentPlayer.splitted && currentPlayer.cards.length === 2 && Deck.getVal(currentPlayer.cards[0]) === Deck.getVal(currentPlayer.cards[1]))
				this.split(currentPlayer);
		}

		// If the player is standing, increment the index of choosing player
		while(!this.players[this.choosing].splitted && this.players[this.choosing].stand || this.players[this.choosing].splitted && this.players[this.choosing].splitStand) {
			if(this.players[++this.choosing] === undefined) break;
		}

		this.update(); // Updates the message
		if(this.choosing >= this.players.length) collector.stop('dealEnd'); // If the choosing index is now equal to the length, end the deal
	}

	split(player) { // To split a player hand
		if(player.balance < player.bet) {
			this.channel.send(`${player.user}, you can not afford to split.`).then(m => {
				setTimeout(() => {
					m.delete();
				}, 3000);
			});
			return;
		}
		player.balance -= player.bet; // Removes the bet again for the second hand
		let indexPlayer = this.players.indexOf(player); // Get the index of the player
		this.players.splice(indexPlayer + 1, 0, player) // Duplicate the player
		player.splitCards = [player.cards[1], this.deck.c.shift()]; // Set the 2nd card and a new card for the splitted hand
		player.cards = [player.cards[0], this.deck.c.shift()]; // Keeps only one card and pick a new card for the first array
		player.splitted = true;
		if(Deck.getVal(player.cards[0]) === 'A') { // If the split is aces, stand after drawing
			player.stand = true;
			player.splitStand = true;
		}
	}

	double(player) {
		if(player.cards.length !== 2) { // If player has already picked a card
			this.channel.send(`${player.user}, you can not double since you already picked a card.`).then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 5000);
			});
			return;
		}
		if(player.balance < player.bet) { // If the player does not have enough balance
			this.channel.send(`${player.user}, you can not afford to double.`).then(msg => {
				setTimeout(() => {
					msg.delete();
				}, 5000);
			});
			return;
		}
		player.cards.push(this.deck.c.shift()) // Pick one card
		player.balance -= player.bet; // Removes the bet another time
		player.bet *= 2; // Double the bet value
		player.stand = true; // Stand the player
		this.update(); // Updates the message
	}

	update() {
		this.message.edit(this + ``); // Updates the message
	}

	/***********************************/
	/**********  Insurance  ************/
	/***********************************/

	insurance(thisDealCollector) {
		this.wait = true; // Set wait to true to prevent reaction handling from principal message
		this.channel.send(`The bank has an Ace, would you like to take the insurance (or Even Money) ?\n(You have 20 seconds to choose)`).then(m => {
			m.react('✅'); // React
			m.react('❎');
			let filter = (r, u) => !u.bot; // Filter, no bot
			let insuranceColl = m.createReactionCollector(filter, {time:20000}); // Give 20 seconds max to take insurance
			let insured = []; // Array of insured players
			let notInsured = []; // Array of not insured people
			let ignore = []; // Array of ignored players that can't afford the insurance
			let hasChosen = 0; // Number of players that have chosen to take or not the insurance
			insuranceColl.on('collect', (r, u) => {
				r.users.remove(u); // Remove the reaction
				let playerIns = this.players.find(p => p.user.id === u.id); // Find the player that wants the insurance
				// Ignore players already insured, that already did not take the insurance and bad reactions.
				if(insured.includes(playerIns) || notInsured.includes(playerIns) || (r.emoji.name !== '✅' && r.emoji.name !== '❎')) return;
				++hasChosen; // Increments the number of players that have chosen an action
				if(r.emoji.name === '✅') { // If the player takes the insurance
					if(playerIns.balance >= playerIns.bet / 2) { // If the player can pay insurance
						if(playerIns.val === `21 BlackJack`) { // If the player has a bj
							m.edit(m.content + `\n${playerIns.user} has a BlackJack and takes Even Money`); // Takes even money
							playerIns.balance += playerIns.bet; // Pays the player
							this.players = this.players.filter(p => p !== playerIns); // removes the player from the list
						}else { // No blackjack, normal insurance
							playerIns.balance -= playerIns.bet / 2; // Removes insurance cost from the player's balance
							insured.push(playerIns); // Adds the player to the insured players list
							m.edit(m.content + `\n${playerIns.user} took the insurance.`); // Inform players
						}
					}else { // Can't pay insurance
						if(!ignore.includes(playerIns)) { // If the player is not ignored, adds him to ignore and sends a message
							this.channel.send(`${playerIns.user}, you can not afford the insurance.`).then(m => {
								setTimeout(() => {
									m.delete();
								}, 4000);
							});
							ignore.push(playerIns); // Add the player to the ignore list
						}
					}
				}
				if(hasChosen >= this.players.length) { // If everybody chose an action, stop the collector
					setTimeout(() => {
						insuranceColl.stop('everybodyChose');
					}, 1000);
				}
			});
			insuranceColl.on('end', (c, r) => {
				let reason = null;
				m.reactions.removeAll();
				if(Deck.getVal(this.bank[1]) === 10) { // The bank has a blackjack
					m.edit(`The bank has a BlackJack, you lose your bet if you're not insured.`); // Inform players
					this.bankBj(insured);
					reason = 'bankBj';
				}else { // The bank does not have a bj
					m.edit('The bank does not have a BlackJack, you lose your insurance bet if you took it'); // Inform players
					if(this.choosing >= this.players.length) reason = 'dealEnd';
				}
				setTimeout(() => { // Delete the message after 5 secs
					m.delete();
					if(reason !== null) thisDealCollector.stop(reason);
				}, 5000);
				this.wait = false; // Reset wait to false for players to be able to play
			});
		});
	}

	bankBj(insured) { // Called by insurance if the bank has a blackjack
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
			}, 5000);
		});
	}


	/***********************************/
	/********  End of deals  ***********/
	/***********************************/

	bankDraw() { // Draw cards for the bank and ends the deal
		let bj = this;
		return new Promise((resolve, reject) => {
			setTimeout(() => { // Suspens timeout
				bj.bankReveal = true; // Reveal on for toString to show bank cards
				bj.update(); // Show the first card to reveal

				let bankVal = bj.calcVal(); // Calculates the value of the bank

				let revealInterval = setInterval(() => { // Creates an interval to reveal cards one by one. lifelike
					if((isNaN(bankVal) && parseInt(bankVal.split('/')[1], 10) < 17) || bankVal < 17) { // If the bank value is under 17
						bj.bank.push(bj.deck.c.shift()); // The bank picks a card
						bankVal = bj.calcVal(); // Recalculates the bank value
						bj.update(); // Updates the message
					}else { // If the bank is 17 or over
						clearInterval(revealInterval); // Clear the interval
						// Arrays stocking players to know if they won, lose or pushed
						let win = [];
						let lose = [];
						let push = [];

						bj.players.forEach(p => {
							// If player has an Ace, takes the highest value
							if(isNaN(p.val) && !p.val.includes('BlackJack')) p.val =  parseInt(p.val.split('/')[1], 10);
							if(isNaN(p.val) && p.val.includes('BlackJack')) { // If the player has a natural bj
								if(bankVal === 21 && bj.bank.length === 2) { // The bank also has a natural
									p.balance += p.bet;
									push.push(p);
								}else { // No natural for the bank
									p.balance += 2.5 * p.bet;
									win.push(p);
								}
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
				}, 2500);
			}, 3000);
		});
	}

	editWin(win, lose, push, bankVal) { // Edit the principal message with end deal information
		console.log(`Deal ended, bank cards : ${this.bank} (${bankVal})`);
		let bj = this;
		return new Promise((resolve, reject) => {
			let mess = `💸 💰 Bank 🏦 💸 | ${bj.bank.join(' | ')} (${bankVal > 21 ? bankVal +  ` BUST` : bankVal})\n`;
			bj.players.forEach(p => {
				console.log(`${p.user.tag} (${p.user.id}) : ${p} (${p.val}) -- ${p.splitCards} (${p.splitVal})`);
				if(win.includes(p)) {
					console.log(`${p.user.tag} (${p.user.id}) wins | New balance : ${p.balance}`);
					if(isNaN(p.val) && p.val.includes('BlackJack'))
						mess += `💰 | ${p.user} wins ${p.bet*1.5} (BlackJack)\n`;
					else
						mess += `💰 | ${p.user} wins ${p.bet}\n`;
				}else if(lose.includes(p)) {
					console.log(`${p.user.tag} (${p.user.id}) loses | New balance : ${p.balance}`);
					mess += `☠️ | ${p.user} loses their bet of ${p.bet}\n`;
				}else if(push.includes(p)){
					console.log(`${p.user.tag} (${p.user.id}) push | New balance : ${p.balance}`);
					mess += `↕️ | ${p.user} push and get their bet back (${p.bet})\n`;
				}else {
					console.log(`Error, ${p.user.tag} not found in win, lose or push`);
				}
			});
			bj.message.edit(mess).then(msg => resolve(msg));
		});
	}


	/***********************************/
	/***********   Other   *************/
	/***********************************/

	calcVal() { // Calculates the value of the bank
		let val = 0;
		let ace = false;

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

	reset() { // Reset all vals at the end of the game
		this.dealing = false;
		this.bank = [];
		this.choosing = 0;
		this.betters = null;
		this.bankReveal = false;
		this.players.forEach(p => { // Reset all player values
			p.bet = 0;
			p.val = 0;
			p.splitVal = 0;
			p.cards = [];
			p.stand = false;
			p.splitted = false;
			p.splitStand = false;
		});
		this.players = [];
		Player.saveAll(this.allPlayers); // Save the state of all players
		setTimeout(() => {
			this.message.delete();
		}, 4000);
	}

	getBalance(user) { // Get the balance of a specific user
		let player = this.allPlayers.find(p => p.user.id === user.id);
		if(player !== undefined) {
			return `Your current balance is ${player.balance}`;
		}else {
			return `Player not found in memory, you'll start with 10 000, to place a bet, type bet in the game channel`;
		}
	}

	toString() { // Returns the state of the game as a string with all the players, their cards and if it's their turn to choose what to do
		let bankVal = this.calcVal();
		let ret = `💸 💰 Bank 🏦 💸 | ${this.bank[0]}${this.bankReveal ? ' | ' + this.bank.slice(1).join(' | ') : ''} (${bankVal > 21 ? bankVal +  ` BUST` : bankVal})\n`; // Bank cards
		let alreadyStringed = []; // Used in case of a splitted player to string the 2 different hands
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
