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
		this.changeShoe = false;
	}

	deal() {
		this.dealing = true;
		let playerNb = this.players.length;
		if(this.changeShoe) {this.deck.shuffle(); this.changeShoe = false;} // Reshuffles the deck
		if(this.deck.c.length < (6*52)/2) { // If we exceded half of the shoe, change it on the next deal
			this.changeShoe = true;
			this.channel.send(`The shoe will be changed on the next deal.`);
		}
		for(let i = 0; i < 2; ++i) { // Deal 2 cards to each player
			this.players.forEach(p => {
				p.cards.push(this.deck.c.shift());
			});
			this.bank.push(this.deck.c.shift()); // Deal one card to the bank
		}
		this.channel.send(this + `\n`).then(m => {
			this.message = m;
			m.react('%E2%A4%B5%EF%B8%8F'); // %E2%A4%B5%EF%B8%8F HIT
			m.react('%E2%8F%B9%EF%B8%8F'); // %E2%8F%B9%EF%B8%8F Stop
			m.react('2%EF%B8%8F%E2%83%A3'); // 2%EF%B8%8F%E2%83%A3 DOUBLE
			m.react('%E2%86%94%EF%B8%8F'); // %E2%86%94%EF%B8%8F SPLIT
			let filter = (r, u) => !u.bot && this.players.find(p => p.user.id === u.id) !== null;
			let collector = m.createReactionCollector(filter);
			collector.on('collect', (r, u) => this.handleReactions(r, u, playerNb, collector));
			collector.on('end', (c, r) => {
				this.message.reactions.removeAll();
				this.players.forEach(p => {
					p.bet = 0;
					p.cards = [];
				});
				this.dealing = false;
				this.bank = [];
				this.choosing = 0;
			});
		})
	}

	handleReactions(r, u, playerNb, collector) {
		r.users.remove(u);
		if(u.id !== this.players[this.choosing].user.id) return;
		if(r.emoji.identifier === '%E2%A4%B5%EF%B8%8F') { // Hit
			this.players.find(p => p.user.id === u.id).cards.push(this.deck.c.shift());
			this.update();
		}else if(r.emoji.identifier === '%E2%8F%B9%EF%B8%8F') { // Stand
			++this.choosing;
		}else if(r.emoji.identifier === '2%EF%B8%8F%E2%83%A3') { // Double down

		}else if(r.emoji.identifier === '%E2%86%94%EF%B8%8F') { // Split

		}
		if(this.choosing >= playerNb) collector.stop('dealEnd');
	}

	update() {
		this.message.edit(this + ``);
	}

	addPlayer(user) {
		this.players.push(new Player(user));
	}


	bet(better, amount) {
		better.bet = amount;
	}


	toString() {
		let ret = `${this.bank[0]} (${Deck.getVal(this.bank[0]) === 'A' ? '1/11' : Deck.getVal(this.bank[0])})\n`;
		this.players.forEach(p => {
			let val = 0;
			let ace = false;
			p.cards.forEach(c => {
				if(Deck.getVal(c) == 'A') {
					ace = true;
				}else {
					val += Deck.getVal(c);
				}
			});
			if(ace) val = val+11 > 21 ? val+11 : `${val+1}/${val+11}`;
			if(val > 21) {
				p.bust = true;
				val = `${val} BUST`;
			}
			ret += `${p.user} | ${p} (${val})\n`;
		});
		return ret;
	}
}

module.exports = BlackJack;
