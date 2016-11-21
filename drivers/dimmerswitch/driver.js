'use strict';

const Driver	= require('../../lib/Driver.js');

const buttonEventMap		= {
	'1002': 'on',
	'2002': 'increase_brightness',
	'3002': 'decrease_brightness',
	'4002': 'off'
}

class DriverDimmerSwitch extends Driver {

	constructor() {
		super();

		this._deviceType = 'sensor';

		Homey
			.manager('flow')
			.on('trigger.dimmerswitch_button_pressed', this._onFlowTriggerDimmerSwitchButtonPressed.bind(this));

	}

	_syncDevice( device_data ) {
		this.debug('_syncDevice', device_data.id);

		let deviceInstance = this.getDeviceInstance( device_data );
		if( deviceInstance instanceof Error )
			return module.exports.setUnavailable( device_data, __('unreachable') );

		module.exports.setAvailable( device_data );

		// if button changed, but not first time
		if( typeof this._devices[ device_data.id ].buttonEvent === 'undefined' ) {
			this._devices[ device_data.id ].buttonEvent = deviceInstance.state.buttonEvent;
			this._devices[ device_data.id ].lastUpdated = deviceInstance.state.lastUpdated;
		} else {

			// if last press changed and button is the same
			if( deviceInstance.state.lastUpdated !== this._devices[ device_data.id ].lastUpdated
			 && deviceInstance.state.buttonEvent === this._devices[ device_data.id ].buttonEvent ) {
				this._devices[ device_data.id ].lastUpdated = deviceInstance.state.lastUpdated;

				Homey.manager('flow').triggerDevice('dimmerswitch_button_pressed', null, {
					button: buttonEventMap[ deviceInstance.state.buttonEvent ]
				}, device_data);

			}

			// else if the button has changed
			else if( this._devices[ device_data.id ].buttonEvent !== deviceInstance.state.buttonEvent ) {
				this._devices[ device_data.id ].buttonEvent = deviceInstance.state.buttonEvent;
				this._devices[ device_data.id ].lastUpdated = deviceInstance.state.lastUpdated;

				Homey.manager('flow').triggerDevice('dimmerswitch_button_pressed', null, {
					button: buttonEventMap[ deviceInstance.state.buttonEvent ]
				}, device_data);

			}
		}

	}

	_onExportsPairListDevices( state, data, callback ) {

		if( !state.bridge )
			return callback( 'invalid_bridge' );

		if( state.bridge instanceof Error )
			return callback( state.bridge );

		let result = [];

		for( let sensor of state.bridge.getSensors() ) {

			if( sensor.modelId !== 'RWL020'
			 && sensor.modelId !== 'RWL021' ) continue;

			let deviceObj = {
				name			: sensor.name,
				data 			: this.getDeviceData( state.bridge, sensor )
			};

			result.push( deviceObj );

		}

		callback( null, result );
	}

	/*
		Flow methods
	*/
	_onFlowTriggerDimmerSwitchButtonPressed( callback, args, state ) {
		callback( null, args.button === state.button );
	}
}

module.exports = new DriverDimmerSwitch();