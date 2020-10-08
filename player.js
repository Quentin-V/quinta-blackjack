var fs = require('fs');
const Deck = require('./cards.js');

class Player {
	constructor(user, balance = 10000) {
		this.user = user;
		this.balance = balance;
		this.cards = [];
		this.bet = 0;
		this.val = 0;

		this.splitCards = [];
		this.splitted = false;
		this.splitVal = 0;

		this.stand = false;
		this.splitStand = false;
	}

	static loadAll() { // Loads data from all players form the save file
		let all = [];
		let content = fs.readFileSync('./save.json');
		let jsonContent = JSON.parse(content);
		jsonContent.forEach(player => {
			all.push(new Player(player.user, player.balance));
		});
		return all;
	}

	static saveAll(players) { // Save all players into the save file
		fs.writeFileSync('./save.json', JSON.stringify(players, null, 4), 'utf8');
	}

	save() { // Save a specific player into the save file
		fs.readFile('./save.json', (err, data) => {
			let found = false;
			// If the file doesn't exists, creates the file
			let jsonData = err && err.errno === -4058 ? Player.createSaveFile() : JSON.parse(data);
			jsonData.forEach(s => {
				if(s.user.id === this.user.id) {
					s.balance = this.balance;
					found = true;
				}
			})
			if(!found) jsonData.push(this); // If the player is not in the save, adds the player to the save
			fs.writeFileSync('./save.json', JSON.stringify(jsonData, null, 4), 'utf8');
		});
	}

	toString() { // Returns the payer cards separated by |
		return this.cards.join(' | ');
	}

	splitCardsToString() { // Tostring with cards from the split hand
		return this.splitCards.join(' | ');
	}

	calcVal(cards = this.cards, stand = this.stand) { // Calculates the value of the hand and save it in the variable
		let val = 0; // Reset val
		let ace = false; // Set ace

		cards.forEach(c => { // To check each card
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

		if(val === `11/21` && cards.length === 2 || val > 21 || val === 21) { // If blackjack or bust or 21, stand the player
			stand = true;
			if(val === `11/21` && cards.length === 2) // If the player has a BlackJack
				val = `21 BlackJack`; // Change value
		}
		if(cards === this.cards) {
			this.val = val;
		}else {
			this.splitVal = val;
		}
		return val;
	}

	static createSaveFile(p) { // Creates the save file if needed
		fs.writeFileSync('./save.json', '[]', 'utf8');
		return '[]';
	}
}


module.exports = Player;
