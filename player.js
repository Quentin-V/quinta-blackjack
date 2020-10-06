var fs = require('fs');
const Deck = require('./cards.js');

class Player {
	constructor(user, balance = 10000) {
		this.user = user;
		this.balance = balance;
		this.cards = [];
		this.bet = 0;
		this.val = 0;

		this.stand = false;
	}

	loadUser(user) {
		return new Promise((resolve, reject) => {
			fs.exists('./save.json', exists => {
				if(exists) {
					let content = fs.readFileSync('./save.json');
					let jsonContent = JSON.parse(content);
					jsonContent.forEach(player => {
						if(player.user.id === user.id) {
							this.balance = player.balance;
							resolve(player);
						}
					});
					resolve(null);
				}
			});
		});
	}

	static loadAll() {
		let all = [];
		let content = fs.readFileSync('./save.json');
		let jsonContent = JSON.parse(content);
		jsonContent.forEach(player => {
			all.push(new Player(player.user, player.balance));
		});
		return all;
	}

	static saveAll(players) {
		fs.exists('./save.json', exists => {
			if(!exists) Player.createSaveFile();
			fs.writeFileSync('./save.json', JSON.stringify(players, null, 4), 'utf8');
		});
	}

	save() {
		fs.exists('./save.json', exists => {
			if(!exists)
				Player.createSaveFile(this);
			fs.readFile('./save.json', (err, data) => {
				if(err) throw err;
				let jsonData = JSON.parse(data);
				let changed = false;
				jsonData.forEach(s => {
					console.log(s);
					console.log(s.user.id);
					if(s.user.id === this.user.id) {
						s.balance = this.balance;
						changed = true;
					}
				})
				if(!changed) jsonData.push(this);
				fs.writeFileSync('./save.json', JSON.stringify(jsonData, null, 4), 'utf8');
			});
		});
	}

	toString() {
		return this.cards.join(' | ');
	}

	calcVal() {
		this.val = 0; // Reset val
		let ace = false; // Set ace

		this.cards.forEach(c => { // To check each card
			if(Deck.getVal(c) == 'A') { // If the card is an ace
				if(ace) // It is not the first ace of the player's hand
					this.val += 1; // Add 1 to val since 2 aces can't be 1/11, do not change ace boolean to still get a 1/11 ace
				ace = true; // Sets ace to true to know that there's an ace in the player's hand
			}else {
				this.val += Deck.getVal(c); // Add the value of the card to the hand value
			}
		});

		if(ace) // If the player has an ace
			this.val = this.val+11 > 21 ? this.val+1 : `${this.val+1}/${this.val+11}`; // Displays both values or only the low one if the high one is bust

		if(this.val === `11/21` && this.cards.length === 2 || this.val > 21 || this.val === 21) { // If blackjack or bust or 21, stand the player
			this.stand = true;
			if(this.val === `11/21` && this.cards.length === 2) // If the player has a BlackJack
				this.val = `21 BlackJack`; // Change value
		}
		return this.val;
	}

	static createSaveFile(p) {
		fs.writeFileSync('./save.json', '[]', 'utf8');
	}
}


module.exports = Player;
