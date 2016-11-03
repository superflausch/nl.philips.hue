'use strict';

const Driver	= require('../../lib/Driver.js');

const typeCapabilityMap 	= {
	'on/off light'				: [ 'onoff' ],
	'dimmable light'			: [ 'onoff', 'dim' ],
	'dimmable plug-in unit'		: [ 'onoff', 'dim' ],
	'color temperature light'	: [ 'onoff', 'dim', 'light_temperature' ],
	'color light'				: [ 'onoff', 'dim', 'light_hue', 'light_saturation' ],
	'extended color light'		: [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
}
const defaultIcon 			= 'LCT001';
const iconsMap				= {
	'LCT001'	: 'LCT001',
	'LCT007'	: 'LCT001',
	'LCT002'	: 'LCT002',
	'LCT003'	: 'LCT003',
	'LST001'	: 'LST001',
	'LLC010'	: 'LLC010',
	'LLC011'	: 'LLC011',
	'LLC012'	: 'LLC011',
	'LLC006'	: 'LLC010',
	'LLC007'	: 'LLC007',
	'LLC013'	: 'LLC013',
	'LWB004'	: 'LCT001',
	'LWB006'	: 'LCT001',
	'LWB007'	: 'LCT001',
	'LLM001'	: defaultIcon,
	'LLM010'	: defaultIcon,
	'LLM011'	: defaultIcon,
	'LLM012'	: defaultIcon,
	'LLC020'	: 'LLC020',
	'LST002'	: 'LST001'
}

const capabilityMap			= {
	'onoff'				: 'on',
	'dim'				: 'brightness',
	'light_hue'			: 'hue',
	'light_saturation'	: 'saturation',
	'light_temperature'	: 'colorTemp',
	'light_mode'		: 'colorMode'
}

class DriverBulb extends Driver {

	constructor() {
		super();

		this._deviceType = 'light';
		this._defaultSaveOpts = {
			transitionTime: 0.5
		};

		this.capabilities = {};

		this.capabilities.onoff = {};
		this.capabilities.onoff.get = this._onExportsCapabilitiesOnoffGet.bind(this);
		this.capabilities.onoff.set = this._onExportsCapabilitiesOnoffSet.bind(this);

		this.capabilities.dim = {};
		this.capabilities.dim.get = this._onExportsCapabilitiesDimGet.bind(this);
		this.capabilities.dim.set = this._onExportsCapabilitiesDimSet.bind(this);

		this.capabilities.light_hue = {};
		this.capabilities.light_hue.get = this._onExportsCapabilitiesLightHueGet.bind(this);
		this.capabilities.light_hue.set = this._onExportsCapabilitiesLightHueSet.bind(this);

		this.capabilities.light_saturation = {};
		this.capabilities.light_saturation.get = this._onExportsCapabilitiesLightSaturationGet.bind(this);
		this.capabilities.light_saturation.set = this._onExportsCapabilitiesLightSaturationSet.bind(this);

		this.capabilities.light_temperature = {};
		this.capabilities.light_temperature.get = this._onExportsCapabilitiesLightTemperatureGet.bind(this);
		this.capabilities.light_temperature.set = this._onExportsCapabilitiesLightTemperatureSet.bind(this);

		this.capabilities.light_mode = {};
		this.capabilities.light_mode.get = this._onExportsCapabilitiesLightModeGet.bind(this);
		this.capabilities.light_mode.set = this._onExportsCapabilitiesLightModeSet.bind(this);

		Homey
			.manager('flow')
			.on('action.shortAlert', this._onFlowActionShortAlert.bind(this))
			.on('action.longAlert', this._onFlowActionLongAlert.bind(this))
			.on('action.startColorLoop', this._onFlowActionStartColorLoop.bind(this))
			.on('action.stopColorLoop', this._onFlowActionStopColorLoop.bind(this))
			.on('action.setRandomColor', this._onFlowActionSetRandomColor.bind(this))
			.on('action.brightnessIncrement', this._onFlowActionBrightnessIncrement.bind(this))

	}

	static convertValue( capabilityId, direction, value ) {

		if( capabilityId === 'dim' || capabilityId === 'light_saturation'  ) {
			if( direction === 'get' ) {
				return value / 254;
			} else 	if( direction === 'set' ) {
				return Math.round( value * 254 );
			}
		} else if( capabilityId === 'light_hue' ) {
			if( direction === 'get' ) {
				return value / 65535;
			} else if( direction === 'set' ) {
				return Math.round( value * 65535 );
			}
		} else if( capabilityId === 'light_temperature' ) {
			if( direction === 'get' ) {
				return ( value - 153 ) / ( 500 - 153 );
			} else if( direction === 'set' ) {
				return Math.round( 153 + value * ( 500 - 153 ) );
			}
		} else if( capabilityId === 'light_mode' ) {
			if( direction === 'get' ) {
				return ( value === 'ct' ) ? 'temperature' : 'color'
			}
		} else {
			return value;
		}

	}

	_syncDevice( device_data ) {
		this.debug('_syncDevice', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error )
			return module.exports.setUnavailable( device_data, __('unreachable') );

		module.exports.setAvailable( device_data );
		module.exports.getCapabilities( device_data, ( err, capabilities ) => {
			if( err ) return this.error( err );

			capabilities.forEach(( capabilityId ) => {
				let value = device[ capabilityMap[ capabilityId ] ];
				if( typeof value !== 'undefined' ) {
					let convertedValue = DriverBulb.convertValue( capabilityId, 'get', value );
					module.exports.realtime( device_data, capabilityId, convertedValue );
				}
			});
		})

	}

	_onExportsPairListDevices( state, data, callback ) {

		if( !state.bridge )
			return callback( 'invalid_bridge' );

		if( state.bridge instanceof Error )
			return callback( state.bridge );

		let result = [];

		for( let light of state.bridge.getLights() ) {

			let deviceCapabilities = typeCapabilityMap[ light.type.toLowerCase() ];
			if( !Array.isArray( deviceCapabilities ) ) return;

			let deviceObj = {
				name			: light.name,
				data 			: this.getDeviceData( state.bridge, light ),
				capabilities	: deviceCapabilities
			};

			if( typeof iconsMap[ light.modelId ] === 'string' ) {
				deviceObj.icon = `/icons/${iconsMap[light.modelId]}.svg`;
			}

			result.push( deviceObj );

		}

		callback( null, result );

	}

	_onExportsCapabilitiesOnoffGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesOnoffGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'onoff', 'get', device[ capabilityMap['onoff'] ] ) );
	}

	// onoff
	_onExportsCapabilitiesOnoffSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesOnoffSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['onoff'] ] = DriverBulb.convertValue( 'onoff', 'set', value );
		device.save( callback );
	}

	// dim
	_onExportsCapabilitiesDimGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesDimGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'dim', 'get', device[ capabilityMap['dim'] ] ) );
	}

	_onExportsCapabilitiesDimSet( device_data, value, callback, saveOpts ) {
		this.debug('_onExportsCapabilitiesDimSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['dim'] ] = DriverBulb.convertValue( 'dim', 'set', value );

		device[ capabilityMap['onoff'] ] = DriverBulb.convertValue( 'onoff', 'set', value > 0 );
		module.exports.realtime( device_data, 'onoff', device[ capabilityMap['onoff'] ] );

		if( typeof saveOpts !== 'undefined' ) {
			device.save( saveOpts, callback );
		} else {
			device.save( callback );
		}
	}

	// light_hue
	_onExportsCapabilitiesLightHueGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightHueGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'light_hue', 'get', device[ capabilityMap['light_hue'] ] ) );
	}

	_onExportsCapabilitiesLightHueSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightHueSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_hue'] ] = DriverBulb.convertValue( 'light_hue', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'color' );
	}

	// light_saturation
	_onExportsCapabilitiesLightSaturationGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightSaturationGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'light_saturation', 'get', device[ capabilityMap['light_saturation'] ] ) );
	}

	_onExportsCapabilitiesLightSaturationSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightSaturationSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_saturation'] ] = DriverBulb.convertValue( 'light_saturation', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'color' );
	}

	// light_temperature
	_onExportsCapabilitiesLightTemperatureGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightTemperatureGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'temperature', 'get', device[ capabilityMap['light_temperature'] ] ) );
	}

	_onExportsCapabilitiesLightTemperatureSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightTemperatureSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_temperature'] ] = DriverBulb.convertValue( 'light_temperature', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'temperature' );
	}

	// light_mode
	_onExportsCapabilitiesLightModeGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightModeGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, DriverBulb.convertValue( 'light_mode', 'get', device[ capabilityMap['light_mode'] ] ) );
	}

	_onExportsCapabilitiesLightModeSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightModeSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		if( value === 'color' ) {
			if( device[ capabilityMap['light_hue'] ] === 65535 ) {
				device[ capabilityMap['light_hue'] ]--;
			} else {
				device[ capabilityMap['light_hue'] ]++;
			}
			device.save( callback );
		} else if( value === 'temperature' ) {
			if( device[ capabilityMap['light_temperature'] ] === 500 ) {
				device[ capabilityMap['light_temperature'] ]--;
			} else {
				device[ capabilityMap['light_temperature'] ]++;
			}
			device.save( callback );
		} else {
			callback( new Error('invalid_mode') );
		}
	}

	/*
		Flow methods
	*/
	_onFlowActionShortAlert( callback, args, state ) {

		let device = this.getDevice( args.device );
		if( device instanceof Error ) return callback( device );

		device.alert = 'select';
		device.save( callback );

	}

	_onFlowActionLongAlert( callback, args, state ) {

		let device = this.getDevice( args.device );
		if( device instanceof Error ) return callback( device );

		device.alert = 'lselect';
		device.save( callback );

	}

	_onFlowActionStartColorLoop( callback, args, state ) {

		let device = this.getDevice( args.device );
		if( device instanceof Error ) return callback( device );

		device.effect = 'colorloop';
		device.save( callback );

	}

	_onFlowActionStopColorLoop( callback, args, state ) {

		let device = this.getDevice( args.device );
		if( device instanceof Error ) return callback( device );

		device.effect = 'none';
		device.save( callback );

	}

	_onFlowActionSetRandomColor( callback, args, state ) {

		let device = this.getDevice( args.device );
		if( device instanceof Error ) return callback( device );

		var hue = Math.random();
		var saturation = 1;

		module.exports.realtime( args.device, 'onoff', true );
		module.exports.realtime( args.device, 'light_hue', hue );
		module.exports.realtime( args.device, 'light_saturation', saturation );

		device[ capabilityMap['onoff'] ] = DriverBulb.convertValue( 'onoff', 'set', true );
		device[ capabilityMap['light_hue'] ] = DriverBulb.convertValue( 'light_hue', 'set', hue );
		device[ capabilityMap['light_saturation'] ] = DriverBulb.convertValue( 'light_saturation', 'set', saturation );

		device.save( callback );

	}

	_onFlowActionBrightnessIncrement( callback, args, state ) {
		this._onExportsCapabilitiesDimSet( args.device, args.brightness/100, callback, {
			transitionTime: args.trans
		})
	}

}

module.exports = new DriverBulb();