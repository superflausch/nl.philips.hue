'use strict';

const Log 			= require('homey-log').Log;
const _ 			= require('underscore');

const saveTimeout = 1;

class Driver {

	constructor() {

		this._debug = true;
		this._devices = {};

		this.init = this._onExportsInit.bind(this);
		this.pair = this._onExportsPair.bind(this);
		this.added = this._onExportsAdded.bind(this);
		this.deleted = this._onExportsDeleted.bind(this);
		this.renamed = this._onExportsRenamed.bind(this);

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
		if( Homey.app ) {
			Homey.app.log.bind( Homey.app, `[${this.constructor.name}]` ).apply( Homey.app, arguments );
		}
	}

	error() {
		if( Homey.app ) {
			Homey.app.error.bind( Homey.app, `[${this.constructor.name}]` ).apply( Homey.app, arguments );
		}
	}

	getDeviceData( bridge, device ) {
		return {
			id			: device.uniqueId,
			bridge_id	: bridge.id
		}
	}

	getBridge( device_data ) {
		return Homey.app.getBridge( device_data.bridge_id );
	}

	getDevice( device_data ) {
		return this._devices[ device_data.id ] || new Error('invalid_device');
	}

	getDeviceInstance( device_data ) {

		let bridge = Homey.app.getBridge( device_data.bridge_id );
		if( bridge instanceof Error ) return bridge;

		let device;
		if( this._deviceType === 'sensor' ) {
			device = bridge.getSensor( device_data.id );
		} else if( this._deviceType === 'light' ) {
			device = bridge.getLight( device_data.id );
		} else {
			device = new Error('invalid_device_type');
		}
		return device;

	}

	/*
		Device methods
	*/
	_initDevice( device_data ) {
		this.debug('_initDevice', device_data.id);

		this.getCapabilities( device_data, ( err, capabilities ) => {
			if( err ) return this.error( err );

			// create the device entry
			this.setUnavailable( device_data, __('unreachable') );

			this._devices[ device_data.id ] = {
				data		: device_data,
				state		: {},
				bridge		: undefined,
				instance	: undefined,
				saveTimeout	: undefined,
				saveCbs		: [],
				save		: ( callback ) => {

					callback = callback || function(){}

					let bridge = this.getBridge( device_data );
					if( bridge instanceof Error ) return callback( bridge );

					let deviceInstance = this.getDeviceInstance( device_data );
					if( deviceInstance instanceof Error ) return callback( deviceInstance );

					// store callback
					this._devices[ device_data.id ].saveCbs.push( callback );

					// clear previous timeout
					if( this._devices[ device_data.id ].saveTimeout ) {
						clearTimeout(this._devices[ device_data.id ].saveTimeout);
					}

					this._devices[ device_data.id ].saveTimeout = setTimeout(() => {

						if( typeof this._onBeforeSave === 'function' ) {
							this._onBeforeSave( device_data );
						}

						// apply queued instance properties
						for( let key in this._devices[ device_data.id ].setInstanceProperties ) {
							let value = this._devices[ device_data.id ].setInstanceProperties[ key ];
							deviceInstance[ key ] = value;
						}
						this._devices[ device_data.id ].setInstanceProperties = {};

						// apply queued instance config properties
						for( let key in this._devices[ device_data.id ].setInstanceConfigProperties ) {
							let value = this._devices[ device_data.id ].setInstanceConfigProperties[ key ];
							deviceInstance.config[ key ] = value;
						}
						this._devices[ device_data.id ].setInstanceConfigProperties = {};

						// save and fire callbacks
						return bridge.save( this._deviceType, deviceInstance )
							.then(( result ) => {
								this._devices[ device_data.id ].saveCbs.forEach(( callback ) => {
									callback( null, result );
								});
							})
							.catch(( err ) => {
								this.error( err );
								this._devices[ device_data.id ].saveCbs.forEach(( callback ) => {
									callback( err );
								});
								Log.captureException( err );
							})
							.then(() => {
								this._devices[ device_data.id ].saveCbs = [];
							})

					}, saveTimeout);

				},
				setInstanceProperties: {},
				setInstanceProperty	: ( key, value ) => {

					let device = this.getDevice( device_data );
					if( device instanceof Error ) return this.error( device );

					let deviceInstance = this.getDeviceInstance( device_data );
					if( deviceInstance instanceof Error ) return this.error( deviceInstance );

					if( device.state.on !== true && ( key === 'effect' || key === 'alert' ) ) return;

					if( key === 'effect' && typeof deviceInstance.effect !== 'string' ) return;
					if( key === 'alert' && typeof deviceInstance.alert !== 'string' ) return;

					this._devices[ device_data.id ].setInstanceProperties[ key ] = value;
				},
				setInstanceConfigProperties: {},
				setInstanceConfigProperty : ( key, value ) => {

					let device = this.getDevice( device_data );
					if( device instanceof Error ) return this.error( device );

					let deviceInstance = this.getDeviceInstance( device_data );
					if( deviceInstance instanceof Error ) return this.error( deviceInstance );

					if( device.state.on === false && ( key === 'on' ) ) return;

					if( key === 'on' && typeof deviceInstance.config.on !== 'boolean' ) return;

					this._devices[ device_data.id ].setInstanceConfigProperties[ key ] = value;
				},
				syncFn: () => {
					this._syncDevice( device_data );
				}
			}

			// add state
			capabilities.forEach(( capability ) => {
				this._devices[ device_data.id ].state[ capability ] = null;
			});

			// wait for the bridge to be available
			let deviceInstance = this.getDeviceInstance( device_data );
			if( deviceInstance instanceof Error ) {
				if( deviceInstance.message === 'invalid_bridge'
				 || deviceInstance.message === 'invalid_light'
				 || deviceInstance.message === 'invalid_sensor' ) {
					Homey.app.once('bridge_available', ( bridge ) => {

						if( bridge.id.toLowerCase() !== device_data.bridge_id.toLowerCase() ) return;

						this.debug('bridge_available');

						bridge.on('refresh', this._devices[ device_data.id ].syncFn);
						this._syncDevice( device_data );
					});
				}
			} else {

				let bridge = this.getBridge( device_data );
				if( bridge instanceof Error ) return this.error( bridge );

				bridge.on('refresh', this._devices[ device_data.id ].syncFn);
				this._syncDevice( device_data );
			}
		});

	}

	_uninitDevice( device_data ) {
		this.debug('_uninitDevice', device_data);

		let device = this._devices[ device_data.id ];
		if( device ) {

			let bridge = this.getBridge( device_data );
			if( bridge ) {
				bridge.removeListener('refresh', this._devices[ device_data.id ].syncFn)
			}

			delete this._devices[ device_data.id ];

		}
	}

	_syncDevice( device_data ) {
		// dummy
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

	_onExportsRenamed( device_data, newName ) {
		this.debug( '_onExportsRenamed', device_data, newName );

		let device = this.getDevice( device_data );
		if( device instanceof Error ) return this.error( device );

		device.setInstanceProperty( 'name', newName );
		device.save(( err, result ) => {
			if( err ) return this.error( err );
		});
	}

	_onExportsPair( socket ) {
		this.debug('_onExportsPair');

		let state = {
			connected	: true,
			bridge		: undefined
		};

		socket
			.on('select_bridge', ( data, callback ) => {

				let result = [];
				let bridges = Homey.app.getBridges();
				for( let bridgeId in bridges ) {
					state.bridge = bridges[ bridgeId ];

					result.push({
						id		: bridgeId,
						name	: state.bridge.name || state.bridge.address,
						icon	: state.bridge.icon
					})
				}

				callback( null, result );

			})
			.on('press_button', ( data, callback ) => {

				state.bridge = Homey.app.getBridge( data.bridgeId );
				if( state.bridge instanceof Error ) return callback( bridge );

				if( state.bridge.isAuthenticated() ) {
					return callback( null, true );
				} else {
					register();
					return callback( null, false );
				}

				function register() {
					setTimeout(() => {
						state.bridge.register(( err, result ) => {
							if( err && err.type === 101 && state.connected ) return register();
							if( err ) return register();
							return socket.emit('authenticated');
						})
					}, 1000);
				}

			})
			.on('list_devices', ( data, callback ) => {
				if( this._onExportsPairListDevices ) {
					this._onExportsPairListDevices( state, data, callback );
				} else {
					callback( new Error('missing _onExportsPairListDevices') );
				}
			})
			.on('disconnect', () => {
				state.connected = false;
			})

	}

	static getMAC( str ) {
		return str.split('-')[0].toLowerCase();
	}


}

module.exports = Driver;