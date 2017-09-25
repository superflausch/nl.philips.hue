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
		
		let bridgeId = bridge.id;
		if( typeof bridgeId !== 'string' ) return this.error('invalid bridge id', bridge);
		bridgeId = bridgeId.toLowerCase();
		
		let bridgeIp = bridge.ip;
		if( typeof bridgeId !== 'string' ) return this.error('invalid bridge ip', bridge);
		
		if( this._bridges[bridgeId] instanceof Bridge ) {
			if( this._bridges[bridgeId].getAddress() !== bridgeIp ) {
				bridge.setAddress( bridge.ip );
			}
		} else {		
			this._bridges[bridgeId] = new Bridge( bridgeId, bridgeIp );
			this.emit('bridge', this._bridges[bridgeId]);
		}
	}
	
	getBridges() {
		return this._bridges;
	}
	
	getBridge( bridgeId ) {
		return this._bridges[bridgeId] || new Error('invalid_bridge');
	}
	
}

module.exports = Discovery;