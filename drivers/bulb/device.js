'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const CAPABILITIES_MAP = {
	'onoff'				: 'on',
	'dim'				: 'brightness',
	'light_hue'			: 'hue',
	'light_saturation'	: 'saturation',
	'light_temperature'	: 'colorTemp',
	'light_mode'		: 'colorMode'
}

class DeviceBulb extends Device {
	
	_onSync() {		
		let device = this._getDevice();
		if( device instanceof Error ) return this.error( device );
		
		for( let capabilityId in CAPABILITIES_MAP ) {
			if( !this.hasCapability(capabilityId) ) continue;
			
			let propertyId = CAPABILITIES_MAP[capabilityId];
			let propertyValue = device[propertyId];
			let convertedValue = DeviceBulb.convertValue(capabilityId, 'get', propertyValue);
									
			this.setCapabilityValue( capabilityId, convertedValue )
				.catch( this.error );
			
		}
	}
	
	_onCapabilitiesSet( valueObj, optsObj ) {
		let device = this._getDevice();
		if( device instanceof Error ) return Promise.reject(device);
		
		for( let capabilityId in CAPABILITIES_MAP ) {
			if( !this.hasCapability(capabilityId) ) continue;
			
			let propertyId = CAPABILITIES_MAP[capabilityId];
			let capabilityValue = valueObj[capabilityId];
			if( typeof capabilityValue === 'undefined' ) capabilityValue = this.getCapabilityValue(capabilityId);
			let convertedValue = DeviceBulb.convertValue(capabilityId, 'set', capabilityValue);
			
			// switch light_mode
			let lightMode = valueObj['light_mode'] || this.getCapabilityValue('light_mode');
			if( lightMode === 'temperature' ) {
				if( capabilityId === 'light_hue' || capabilityId === 'light_saturation' ) convertedValue = null;
			} else if( lightMode === 'color' ) {
				if( capabilityId === 'light_temperature' ) convertedValue = null;
			}
						
			if( convertedValue === null ) continue;
			
			try {
				device[propertyId] = convertedValue;
			} catch( err ) {
				this.error( err );
			}
		}
		
		return this._bridge.saveLight( device )
			.catch( err => {
				this.error( err );
				throw err;
			});
		
	}
	
	static convertValue( capabilityId, direction, value ) {

		if( capabilityId === 'dim' || capabilityId === 'light_saturation'  ) {
			if( direction === 'get' ) {
				return value / 254;
			} else if( direction === 'set' ) {
				return Math.ceil( value * 254 );
			}
		} else if( capabilityId === 'light_hue' ) {
			if( direction === 'get' ) {
				return value / 65535;
			} else if( direction === 'set' ) {
				return Math.ceil( value * 65535 );
			}
		} else if( capabilityId === 'light_temperature' ) {
			if( direction === 'get' ) {
				return ( value - 153 ) / ( 500 - 153 );
			} else if( direction === 'set' ) {
				return Math.ceil( 153 + value * ( 500 - 153 ) );
			}
		} else if( capabilityId === 'light_mode' ) {
			if( direction === 'get' ) {
				return ( value === 'ct' ) ? 'temperature' : 'color'
			} else if( direction === 'set' ) {
				return null;
			}
		} else {
			return value;
		}

	}
}

module.exports = DeviceBulb;