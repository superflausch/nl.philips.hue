"use strict";

const nodeHueApi = require("node-hue-api");

class App {

	constructor() {

		this._bridges = {};

		this.init = this._exportsInit.bind(this);


	}

	_exportsInit() {

		console.log(`${Homey.manifest.id} running...`);

	}



}

module.exports = new App();