const cards = ['Ace', 'Deuce', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];
const colors = [':clubs:', ':diamonds:', ':hearts:', ':spades:'];

class Deck {
	constructor(deckNb) {
		this.c = [];
		for(let i = 0; i < deckNb; ++i) {
			cards.forEach(card => {
				colors.forEach(col => {
					this.c.push(card + ` ` + col);
				});
			});
		}
		this.shuffle(this);
	}

	static getVal(card) {
		let symbol = card.split(' ')[0];
		let index = cards.indexOf(symbol);
		if(index > 8)
			return 10;
		else if(index === 0)
			return 'A';
		else
			return index+1;
	}

	shuffle(deck) {
		this.c.sort(() => Math.random() - 0.5);
	}
}

module.exports = Deck;
