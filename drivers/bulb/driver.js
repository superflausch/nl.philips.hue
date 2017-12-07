'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

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

class DriverBulb extends Driver {
	
	onInit() {
		super.onInit();
		
		/*
			Initialize Flow
		*/
		new Homey.FlowCardAction('shortAlert')
			.register()
			.registerRunListener( args => args.device.shortAlert() );
			
		new Homey.FlowCardAction('longAlert')
			.register()
			.registerRunListener( args => args.device.longAlert() );
			
		new Homey.FlowCardAction('startColorLoop')
			.register()
			.registerRunListener( args => args.device.startColorLoop() );
			
		new Homey.FlowCardAction('stopColorLoop')
			.register()
			.registerRunListener( args => args.device.stopColorLoop() );
			
		new Homey.FlowCardAction('setRandomColor')
			.register()
			.registerRunListener( args => args.device.setRandomColor() );
	}

	_onPairListDevices( state, data, callback ) {

		if( !state.bridge )
			return callback( new Error('invalid_bridge') );

		if( state.bridge instanceof Error )
			return callback( state.bridge );

		let result = [];
		let lights = state.bridge.getLights();
		
		for( let lightId in lights ) {
			let light = lights[lightId];

			let deviceCapabilities = typeCapabilityMap[ light.type.toLowerCase() ];
			if( !Array.isArray( deviceCapabilities ) ) continue;

			let deviceObj = {
				name			: light.name,
				data 			: Homey.app.getDeviceData( state.bridge, light ),
				capabilities	: deviceCapabilities
			};

			if( typeof iconsMap[ light.modelId ] === 'string' ) {
				deviceObj.icon = `/icons/${iconsMap[light.modelId]}.svg`;
			}

			result.push( deviceObj );

		}

		callback( null, result );

	}
}

module.exports = DriverBulb;