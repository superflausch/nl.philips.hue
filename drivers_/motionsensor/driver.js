'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

const SUPPORTED_SENSORS = [
  'SML001',
  'SML002',
];

const iconsMap = {
	'SML001'	: 'SML001',
	'SML002'	: 'SML002',
}

class DriverMotionSensor extends Driver {
	
	onInit() {
		super.onInit();
		
		/*
			Initialize Flow
		*/
		new Homey.FlowCardAction('enableMotionSensor')
			.register()
			.registerRunListener( args => args.device.enable() );
			
		new Homey.FlowCardAction('disableMotionSensor')
			.register()
			.registerRunListener( args => args.device.disable() );
	}

	_onPairListDevices( state, data, callback ) {

		if( !state.bridge )
			return callback( new Error('invalid_bridge') );

		if( state.bridge instanceof Error )
			return callback( state.bridge );

		let result = [];
		let sensors = state.bridge.getSensors();

		for( let sensorId in sensors ) {
			let sensor = sensors[sensorId];
			this.log('Model ID:', sensor.modelId, sensor.name);

			if( !SUPPORTED_SENSORS.includes(sensor.modelId)
			 || sensor.type !== 'ZLLPresence' ) continue;

			let deviceObj = {
				name: sensor.name,
				data: Homey.app.getDeviceData( state.bridge, sensor )
			};

			if( typeof iconsMap[ sensor.modelId ] === 'string' ) {
				deviceObj.icon = `/icons/${iconsMap[sensor.modelId]}.svg`;
			}

			result.push( deviceObj );

		}

		callback( null, result );

	}
}

module.exports = DriverMotionSensor;