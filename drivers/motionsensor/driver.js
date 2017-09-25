'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

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

			if( sensor.modelId !== 'SML001'
			 || sensor.type !== 'ZLLPresence' ) continue;

			let deviceObj = {
				name: sensor.name,
				data: Homey.app.getDeviceData( state.bridge, sensor )
			};

			result.push( deviceObj );

		}

		callback( null, result );

	}
}

module.exports = DriverMotionSensor;