var fs = require ('fs');

module.exports = {
	stream: null,
	streamDate: null,
	log(message) {
		let d = new Date();
		let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
		let mo = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(d);
		let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
		if(this.stream === null || this.streamDate !== `${ye}-${mo}-${da}`) {
			this.createStream(ye, mo, da, message);
		}else {
			this.stream.write(message + "\n");
		}
	},

	createStream(ye, mo, da, message) {
		if(!fs.existsSync('logs')) fs.mkdirSync('logs');
		this.stream = fs.createWriteStream(`./logs/${ye}-${mo}-${da}.log`, {flags: 'a'});
		this.streamDate = `${ye}-${mo}-${da}`;
		this.log(message);
	}
}
