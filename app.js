"use strict";

const events		= require('events');
const huejay 		= require('huejay');
const Bridge		= require('./lib/Bridge.js');

class App extends events.EventEmitter {

	constructor() {
		super();

		this._bridges = {};

		this.init = this._onExportsInit.bind(this);

	}

	log() {
		console.log.apply( this, arguments );
	}

	error() {
		console.error.apply( this, arguments );
	}

	findBridges() {

		huejay.discover({strategy: 'all'})
			.then(( bridges ) => {
				bridges.forEach( this._initBridge.bind(this) );
			});

	}

	_initBridge( bridge ) {

		// skip if already found
		if( this._bridges[ bridge.id ] instanceof Bridge ) return;

		this.log(`Found bridge ${bridge.id} @ ${bridge.ip}`);

		this._bridges[ bridge.id ] = new Bridge( bridge.id, bridge.ip );
		this._bridges[ bridge.id ]
			.on('log', this.log.bind( this, `[${bridge.id}]`) )
			.on('error', this.error.bind( this, `[${bridge.id}]`) )
			.on('bridge_available', () => {
				this.emit('bridge_available', this._bridges[ bridge.id ] );
			})
	}

	getBridges() {
		return this._bridges;
	}

	getBridge( bridgeId ) {
		return this._bridges[ bridgeId ] || new Error('invalid_bridge');
	}

	_onExportsInit() {

		console.log(`${Homey.manifest.id} running...`);

		this.findBridges();
		setInterval( this.findBridges.bind(this), 60000 );

	}

}

module.exports = new App();