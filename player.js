var fs = require('fs');

class Player {
	constructor(user, balance = 10000) {
		this.user = user;
		this.loadUser(user).then(found => {
			if(!found) {
				this.balance = balance;
			}
		});
		this.cards = [];
		this.bet = 0;
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
							resolve(true);
						}
					});
					resolve(false);
				}
			});
		});

	}

	toString() {
		return this.cards.join(' | ');
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

	static createSaveFile(p) {
		fs.writeFileSync('./save.json', '[]', 'utf8');
	}
}


module.exports = Player;
