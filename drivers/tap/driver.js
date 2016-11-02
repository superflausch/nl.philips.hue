'use strict';

const sharedPair			= require('../_shared/pair.js');

const buttonEventMap		= {
	'34': 'button1',
	'16': 'button2',
	'17': 'button3',
	'18': 'button4'
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

		Homey.manager('flow').on('trigger.tap_button_pressed', this._onFlowTriggerTapButtonPressed.bind(this));

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
		Homey.app.log.bind( Homey.app, '[dimmerswitch][log]' ).apply( Homey.app, arguments );
	}

	error() {
		Homey.app.error.bind( Homey.app, '[dimmerswitch][error]' ).apply( Homey.app, arguments );
	}

	getDeviceData( bridge, sensor ) {
		return {
			id: sensor.uniqueId,
			bridge_id: bridge.id
		}
	}

	/*
		Device methods
	*/
	_initDevice( device_data ) {
		this.debug('_initDevice', device_data.id);

		this._devices[ device_data.id ] = {
			data: device_data
		}

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

		// if button changed, but not first time
		if( typeof this._devices[ device_data.id ].buttonEvent === 'undefined' ) {
			this._devices[ device_data.id ].buttonEvent = device.state.buttonEvent;
			this._devices[ device_data.id ].lastUpdated = device.state.lastUpdated;
		} else {

			// if last press changed and button is the same
			if( device.state.lastUpdated !== this._devices[ device_data.id ].lastUpdated
			 && device.state.buttonEvent === this._devices[ device_data.id ].buttonEvent ) {
				this._devices[ device_data.id ].lastUpdated = device.state.lastUpdated;

				Homey.manager('flow').triggerDevice('tap_button_pressed', null, {
					button: buttonEventMap[ device.state.buttonEvent ]
				}, device_data);

			}

			// else if the button has changed
			else if( this._devices[ device_data.id ].buttonEvent !== device.state.buttonEvent ) {
				this._devices[ device_data.id ].buttonEvent = device.state.buttonEvent;
				this._devices[ device_data.id ].lastUpdated = device.state.lastUpdated;

				Homey.manager('flow').triggerDevice('tap_button_pressed', null, {
					button: buttonEventMap[ device.state.buttonEvent ]
				}, device_data);

			}
		}

	}

	getBridge( device_data ) {

		let bridge = Homey.app.getBridge( device_data.bridge_id );
		if( bridge instanceof Error ) return bridge;

	}

	getDevice( device_data ) {

		let bridge = Homey.app.getBridge( device_data.bridge_id );
		if( bridge instanceof Error ) return bridge;

		let device = bridge.getSensor( device_data.id );
		if( device instanceof Error ) return device;

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

				for( let sensor of state.bridge.getSensors() ) {

					if( sensor.modelId !== 'ZGPSWITCH' ) continue;

					let deviceObj = {
						name			: sensor.name,
						data 			: this.getDeviceData( state.bridge, sensor )
					};

					result.push( deviceObj );

				}

				callback( null, result );

			}
		});

	}

	/*
		Flow methods
	*/
	_onFlowTriggerTapButtonPressed( callback, args, state ) {
		callback( null, args.button === state.button );
	}
}

module.exports = new Driver();