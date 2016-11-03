'use strict';

const _ = require('underscore');

class Driver {

	constructor() {

		this._debug = true;
		this._defaultSaveOpts = {};
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
		Homey.app.log.bind( Homey.app, `[log][${this.constructor.name}]` ).apply( Homey.app, arguments );
	}

	error() {
		Homey.app.error.bind( Homey.app, `[err][${this.constructor.name}]` ).apply( Homey.app, arguments );
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
		if( device instanceof Error ) return device;

		device.bridge 				= device.bridge || bridge;
		device.saveTimeout 			= device.saveTimeout || undefined;
		device.saveTimeoutCallbacks = device.saveTimeoutCallbacks || [];
		device.save 				= device.save || (( opts, callback ) => {

			if( typeof opts === 'function' ) {
				callback = opts;
				opts = {};
			}

			opts = _.extend({}, this._defaultSaveOpts, opts)

			device.saveTimeoutCallbacks.push( callback );

			if( device.saveTimeout ) {
				clearTimeout(device.saveTimeout);
			}
			device.saveTimeout = setTimeout(() => {

				for( let key in opts ) {
					device[ key ] = opts[ key ];
				}

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

	_onExportsRenamed( device_data ) {
		this.debug( '_onExportsRenamed', device_data );
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

}

module.exports = Driver;