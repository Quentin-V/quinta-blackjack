const cards = ['Ace', 'Deuce', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];
const colors = [':clubs:', ':diamonds:', ':hearts:', ':spades:'];

class Deck {
	constructor(deckNb = 6) {
		this.c = []; // Cards in the deck
		for(let i = 0; i < deckNb; ++i) { // Filling the array with the number of decks given in parameter
			cards.forEach(card => {
				colors.forEach(col => {
					this.c.push(card + ` ` + col);
				});
			});
		}
		this.shuffle(this); // Shuffles the array
	}

	static getVal(card) { // Returns the integer value or A if an ace, of a card given in paramater
		if(card === undefined) return 0;
		let symbol = card.split(' ')[0]; // Get the symbol of the card without the color
		let index = cards.indexOf(symbol); // Finds its index
		if(index > 8)
			return 10;
		else if(index === 0)
			return 'A';
		else
			return index+1;
	}

	shuffle(deck) { // Shuffles the deck
		this.c.sort(() => Math.random() - 0.5);
	}
}

module.exports = Deck;
