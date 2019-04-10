'use strict';

const Homey = require('homey');

const CAPABILITIES_SET_DEBOUNCE = 100;

module.exports = class HueDevice extends Homey.Device {
	
	/*
	onInit() {		
		this._getBridge = this._getBridge.bind(this);
		this._initBridge = this._initBridge.bind(this);
		this._onSync = this._onSync.bind(this);
		this._onCapabilitiesSet = this._onCapabilitiesSet.bind(this);
		
		this._data = this.getData();
		this._deviceId = this._data.id;
		this._bridgeId = this._data.bridge_id;
		
		this._device = new Error('invalid_hue_device');
		
		this.setUnavailable( Homey.__('unreachable') );
		this._getBridge();
		
		this.registerMultipleCapabilityListener(this.getCapabilities(), this._onCapabilitiesSet, CAPABILITIES_SET_DEBOUNCE);
		
	}
	
	onRenamed( newName ) {
		this.log('Renamed', newName);
		
		if( this._device instanceof Error )
			return Promise.reject(this._device);
		
		this._device.name = newName;
		return this._saveDevice();
	}
	
	onAdded() {
		this.log('Added');
	}
	
	onRemoved() {
		this.log('Removed');
		
		if( this._bridge instanceof Bridge ) {
			this._bridge.removeListener('sync', this._onSync);
		}
	}
	
	_saveDevice() {
  	
  	if( !this._bridge )
  	  return Promise.reject( new Error('missing_bridge') );
  	
		let saveFn;
		switch( this.constructor.name ) {
			case 'DeviceBulb':
				saveFn = this._bridge.saveLight;
				break;
			case 'DeviceMotionSensor':
				saveFn = this._bridge.saveSensor;
				break;
			case 'DeviceDimmerSwitch':
				saveFn = this._bridge.saveSensor;
				break;
			case 'DeviceTap':
				saveFn = this._bridge.saveSensor;
				break;
		}
		
		if( typeof saveFn !== 'function' )
			return Promise.reject( new Error('unknown_device') );
			
		return saveFn.call( this._bridge, this._device ).catch( err => {
			this.error( err );
			throw err;
		});
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
			case 'DeviceMotionSensor':
				device = this._bridge.getSensor( this._deviceId );
				break;
			case 'DeviceDimmerSwitch':
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
		this._device = this._getDevice();
	}
	*/
}