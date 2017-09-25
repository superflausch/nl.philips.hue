'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {
	
	onInit() {
		this.log('onInit', this.constructor.name);
		
		
	}
}

module.exports = Driver;