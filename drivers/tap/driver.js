'use strict';

const Homey = require('homey');
const Driver = require('../../lib/Driver.js');

class DriverTap extends Driver {
	
	onInit() {
		super.onInit();
		
		/*
			Initialize Flow
		*/
		this.flowCardTrigger = new Homey.FlowCardTriggerDevice('tap_button_pressed')
			.register()
			.registerRunListener(( args, state ) => args.button === state.button);
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

			if( sensor.modelId !== 'ZGPSWITCH' ) continue;

			let deviceObj = {
				name: sensor.name,
				data: Homey.app.getDeviceData( state.bridge, sensor )
			};

			result.push( deviceObj );

		}

		callback( null, result );

	}
}

module.exports = DriverTap;