'use strict';

const Homey = require('homey');

const Bridge = require('./Bridge.js');

const CAPABILITIES_SET_DEBOUNCE = 100;

class Device extends Homey.Device {
	
	onInit() {
		this.log('onInit', this.constructor.name);
		
		this._getBridge = this._getBridge.bind(this);
		this._initBridge = this._initBridge.bind(this);
		this._onSync = this._onSync.bind(this);
		this._onCapabilitiesSet = this._onCapabilitiesSet.bind(this);
		
		this._data = this.getData();
		this._deviceId = this._data.id;
		this._bridgeId = this._data.bridge_id;
		
		this.setUnavailable( Homey.__('unreachable') );
		this._getBridge();
		
		this.registerMultipleCapabilityListener(this.getCapabilities(), this._onCapabilitiesSet, CAPABILITIES_SET_DEBOUNCE);
		
	}
	
	_onCapabilitiesSet( valueObj, optsObj ) {
		return Promise.resolve();		
	}
	
	_getBridge() {
		let bridge = Homey.app.getBridge(this._bridgeId);
		if( bridge instanceof Bridge ) {
			this._initBridge( bridge );
		} else {
			Homey.app.once(`bridge_${this._bridgeId}`, this._initBridge);			
		}
	}
	
	_getDevice() {
		let device = null;
		switch( this.constructor.name ) {
			case 'DeviceBulb':
				device = this._bridge.getLight( this._deviceId );
				break;
			case 'DeviceSensor':
				device = this._bridge.getSensor( this._deviceId );
				break;
			case 'DeviceSwitch':
				device = this._bridge.getSensor( this._deviceId );
				break;
			case 'DeviceTap':
				device = this._bridge.getSensor( this._deviceId );
				break;
			default:
				device = new Error('unknown_device');
				break;
		}
		
		if( device instanceof Error ) {
			this.setUnavailable( device );
		} else {
			this.setAvailable();
		}
		
		return device;
	}
	
	_initBridge( bridge ) {	
		this._bridge = bridge;
		
		this._bridge.on('sync', this._onSync);
		this._onSync();
	}
	
	_onSync() {
		// placeholder
	}
}

module.exports = Device;