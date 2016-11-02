'use strict';

const sharedPair			= require('../_shared/pair.js');

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

class Driver {

	constructor() {

		this._debug = true;

		this._devices = {};

		this.init = this._onExportsInit.bind(this);
		this.pair = this._onExportsPair.bind(this);
		this.added = this._onExportsAdded.bind(this);
		this.deleted = this._onExportsDeleted.bind(this);
		this.renamed = this._onExportsRenamed.bind(this);

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

		Homey.manager('flow').on('action.shortAlert', this._onFlowActionShortAlert.bind(this));
		Homey.manager('flow').on('action.longAlert', this._onFlowActionLongAlert.bind(this));
		Homey.manager('flow').on('action.startColorLoop', this._onFlowActionStartColorLoop.bind(this));
		Homey.manager('flow').on('action.stopColorLoop', this._onFlowActionStopColorLoop.bind(this));
		Homey.manager('flow').on('action.setRandomColor', this._onFlowActionSetRandomColor.bind(this));
		Homey.manager('flow').on('action.brightnessIncrement', this._onFlowActionBrightnessIncrement.bind(this));

	}

	/*
		Helper methods
	*/
	debug() {
		if( this._debug ) {
			this.log.apply( this, arguments );
		}
	}

	log() {
		Homey.app.log.bind( Homey.app, '[bulb][log]' ).apply( Homey.app, arguments );
	}

	error() {
		Homey.app.error.bind( Homey.app, '[bulb][error]' ).apply( Homey.app, arguments );
	}

	getDeviceData( bridge, light ) {
		return {
			id: light.uniqueId,
			bridge_id: bridge.id
		}
	}

	_convertValue( capabilityId, direction, value ) {

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

	/*
		Device methods
	*/
	_initDevice( device_data ) {
		this.debug('_initDevice', device_data.id);

		this._devices[ device_data.id ] = device_data;

		module.exports.setUnavailable( device_data, __('unreachable') );

		let device = this.getDevice( device_data );
		if( device instanceof Error ) {
			if( device.message === 'invalid_bridge' || device.message === 'invalid_light' ) {
				Homey.app.once('bridge_available', ( bridge ) => {

					bridge.on('refresh', () => {
						this._syncDevice( device_data );
					});
				});
			}
		} else {

			let bridge = this.getBridge( device_data );
			if( bridge instanceof Error ) return this.error( bridge );

			bridge.on('refresh', () => {
				this._syncDevice( device_data );
			});
		}

	}

	_uninitDevice( device_data ) {
		this.debug('_uninitDevice', device_data);

		delete this._devices[ device_data.id ];

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
					let convertedValue = this._convertValue( capabilityId, 'get', value );
					module.exports.realtime( device_data, capabilityId, convertedValue );
				}
			});
		})

	}

	getBridge( device_data ) {

		let bridge = Homey.app.getBridge( device_data.bridge_id );
		if( bridge instanceof Error ) return bridge;

	}

	getDevice( device_data ) {

		let bridge = Homey.app.getBridge( device_data.bridge_id );
		if( bridge instanceof Error ) return bridge;

		let device = bridge.getLight( device_data.id );
		if( device instanceof Error ) return device;

		device.bridge 				= device.bridge || bridge;
		device.saveTimeout 			= device.saveTimeout || undefined;
		device.saveTimeoutCallbacks = device.saveTimeoutCallbacks || [];
		device.save 				= device.save || (( transitionTime, callback ) => {

			if( typeof transitionTime === 'function' ) {
				callback = transitionTime;
				transitionTime = 0.5;
			}

			device.saveTimeoutCallbacks.push( callback );

			if( device.saveTimeout ) {
				clearTimeout(device.saveTimeout);
			}
			device.saveTimeout = setTimeout(() => {

				device.transitionTime = transitionTime;

				return bridge.saveLight( device )
					.then(( result ) => {
						device.saveTimeoutCallbacks.forEach(( callback ) => {
							callback && callback( null, result );
						});
					})
					.catch(( err ) => {
						this.error( err );
						device.saveTimeoutCallbacks.forEach(( callback ) => {
							callback && callback( err );
						});
					})
					.then(() => {
						device.saveTimeoutCallbacks = [];
					})

			}, 500);
		})

		return device;
	}

	/*
		Exports methods
	*/
	_onExportsInit( devices_data, callback ) {
		this.debug( '_onExportsInit', devices_data );

		devices_data.forEach( this._initDevice.bind(this) );

		callback();

	}

	_onExportsAdded( device_data ) {
		this.debug( '_onExportsAdded', device_data );
		this._initDevice( device_data );
	}

	_onExportsDeleted( device_data ) {
		this.debug( '_onExportsDeleted', device_data );
		this._uninitDevice( device_data );
	}

	_onExportsRenamed( device_data ) {
		this.debug( '_onExportsRenamed', device_data );

		// TODO
	}

	_onExportsPair( socket ) {
		this.debug('_onExportsPair');

		sharedPair( socket, {
			'list_devices': ( state, data, callback ) => {

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
		});

	}

	_onExportsCapabilitiesOnoffGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesOnoffGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'onoff', 'get', device[ capabilityMap['onoff'] ] ) );
	}

	// onoff
	_onExportsCapabilitiesOnoffSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesOnoffSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['onoff'] ] = this._convertValue( 'onoff', 'set', value );
		device.save( callback );
	}

	// dim
	_onExportsCapabilitiesDimGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesDimGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'dim', 'get', device[ capabilityMap['dim'] ] ) );
	}

	_onExportsCapabilitiesDimSet( device_data, value, callback, transitionTime ) {
		this.debug('_onExportsCapabilitiesDimSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['dim'] ] = this._convertValue( 'dim', 'set', value );

		device[ capabilityMap['onoff'] ] = this._convertValue( 'onoff', 'set', value > 0 );
		module.exports.realtime( device_data, 'onoff', device[ capabilityMap['onoff'] ] );

		if( typeof transitionTime === 'number' ) {
			device.save( transitionTime, callback );
		} else {
			device.save( callback );
		}
	}

	// light_hue
	_onExportsCapabilitiesLightHueGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightHueGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'light_hue', 'get', device[ capabilityMap['light_hue'] ] ) );
	}

	_onExportsCapabilitiesLightHueSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightHueSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_hue'] ] = this._convertValue( 'light_hue', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'color' );
	}

	// light_saturation
	_onExportsCapabilitiesLightSaturationGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightSaturationGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'light_saturation', 'get', device[ capabilityMap['light_saturation'] ] ) );
	}

	_onExportsCapabilitiesLightSaturationSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightSaturationSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_saturation'] ] = this._convertValue( 'light_saturation', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'color' );
	}

	// light_temperature
	_onExportsCapabilitiesLightTemperatureGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightTemperatureGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'temperature', 'get', device[ capabilityMap['light_temperature'] ] ) );
	}

	_onExportsCapabilitiesLightTemperatureSet( device_data, value, callback ) {
		this.debug('_onExportsCapabilitiesLightTemperatureSet', device_data.id, value);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		device[ capabilityMap['light_temperature'] ] = this._convertValue( 'light_temperature', 'set', value );
		device.save( callback );

		module.exports.realtime( device_data, 'light_mode', 'temperature' );
	}

	// light_mode
	_onExportsCapabilitiesLightModeGet( device_data, callback ) {
		this.debug('_onExportsCapabilitiesLightModeGet', device_data.id);

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return callback( device );

		callback( null, this._convertValue( 'light_mode', 'get', device[ capabilityMap['light_mode'] ] ) );
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

		module.exports.realtime( args.device, 'light_hue', hue );
		module.exports.realtime( args.device, 'light_saturation', saturation );

		device[ capabilityMap['light_hue'] ] = this._convertValue( 'light_hue', 'set', hue );
		device[ capabilityMap['light_saturation'] ] = this._convertValue( 'light_saturation', 'set', saturation );

		device.save( callback );

	}

	_onFlowActionBrightnessIncrement( callback, args, state ) {
		this._onExportsCapabilitiesDimSet( args.device, args.brightness/100, callback, args.trans )
	}

}

module.exports = new Driver();