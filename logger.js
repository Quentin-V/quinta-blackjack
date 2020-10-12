var fs = require ('fs');

module.exports = {
	stream = null;
	streamDate = null;
	log(message) {
		let d = new Date();
		let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
		let mo = new Intl.DateTimeFormat('en', { month: 'numeric' }).format(d);
		let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
		if(this.stream === null || this.streamDate !== `${ye}-${mo}-${da}`) createStream(ye, mo, da);
		this.stream.write(message);
	}

	createStream(ye, mo, da) {
		this.stream = fs.createwriteStream(`${ye}-${mo}-${da}.log`, {flags: 'a'});
		this.streamDate = `${ye}-${mo}-${da}`;
	}
}
