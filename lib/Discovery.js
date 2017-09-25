'use strict';

const Homey = require('homey');

const huejay = require('huejay');

const Bridge = require('./Bridge.js');

const DISCOVER_INTERVAL = 5000;
const DISCOVER_STRATEGIES = [ 'nupnp', 'upnp' ];

class Discovery extends Homey.SimpleClass {
	
	constructor() {
		super();
		
		this._discover = this._discover.bind(this);
		this._initBridge = this._initBridge.bind(this);
		
		this._bridges = {};
	}
	
	start() {
		if( this._discoverInterval ) clearInterval(this._discoverInterval);
		this._discoverInterval = setInterval(this._discover, DISCOVER_INTERVAL);
		this._discover();
	}
	
	stop() {
		if( this._discoverInterval ) clearInterval(this._discoverInterval);		
	}
	
	_discover() {
		DISCOVER_STRATEGIES.forEach(( strategy ) => {
			huejay.discover({ strategy })
				.then(( bridges ) => {
					bridges.forEach( this._initBridge );
				})
				.catch( this.error );
		});
	}
	
	_initBridge( bridge ) {
		if( this._bridges[bridge.id] instanceof Bridge ) {
			if( this._bridges[bridge.id].getAddress() !== bridge.ip ) {
				bridge.setAddress( bridge.ip );
			}
		} else {		
			this._bridges[bridge.id] = new Bridge( bridge.id, bridge.ip );
			this.emit('bridge', this._bridges[bridge.id]);
		}
	}
	
	getBridges() {
		return this._bridges;
	}
	
	getBridge( bridgeId ) {
		return this._bridges[bridgeId];
	}
	
}

module.exports = Discovery;