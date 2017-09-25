'use strict';

const Log = require('homey-log').Log;
const huejay = require('huejay');
const Bridge = require('./lib/Bridge.js');

const findBridgesInterval 	= 60000;
const discoverStrategies 	= [ 'nupnp', 'upnp' ];

class App extends events.EventEmitter {

	constructor() {
		super();

		this.setMaxListeners(0);

		this._bridges = {};

		this.init = this._onExportsInit.bind(this);

		Homey.manager('flow').on('action.setScene', this._onFlowActionSetScene.bind(this));
		Homey.manager('flow').on('action.setScene.scene.autocomplete', this._onFlowActionSetSceneSceneAutocomplete.bind(this));
		Homey.manager('flow').on('action.groupOn', this._onFlowActionGroupOn.bind(this));
		Homey.manager('flow').on('action.groupOn.group.autocomplete', this._onFlowActionGroupAutocomplete.bind(this));
		Homey.manager('flow').on('action.groupOff', this._onFlowActionGroupOff.bind(this));
		Homey.manager('flow').on('action.groupOff.group.autocomplete', this._onFlowActionGroupAutocomplete.bind(this));

	}

	/*
		Helper methods
	*/
	log() {
		if( process.env.DEBUG === '1' ) {
			console.log.bind(this, '[log]' ).apply( this, arguments );
		}
	}

	error() {
		console.error.bind( this, '[error]' ).apply( this, arguments );
	}

	/*
		Bridge methods
	*/
	findBridges() {

		discoverStrategies.forEach(( strategy ) => {
			huejay.discover({
				strategy: strategy
			})
				.then(( bridges ) => {
					this.log(`Discovered ${bridges.length} ${strategy} bridges`);
					bridges.forEach( this._initBridge.bind(this) );
				})
				.catch(( err ) => {
					this.error( err );
				})
		});

	}

	_initBridge( bridge ) {

		bridge.id = bridge.id.toLowerCase();

		// skip if already found but update ip if changed
		if( this._bridges[ bridge.id ] instanceof Bridge ) {

			if( this._bridges[ bridge.id ].address !== bridge.ip ) {
				this.log(`Bridge ip has changed from ${this._bridges[ bridge.id ].address} to ${bridge.ip}`);
				this._bridges[ bridge.id ].setAddress( bridge.ip );
			}

			return;
		}

		this.log(`Found bridge ${bridge.id} @ ${bridge.ip}`);
		
		let bridgeId = bridge.id;
		let bridgeInstance = this._bridges[ bridge.id ] = new Bridge( bridge.id, bridge.ip );
			bridgeInstance
				.on('log', this.log.bind( this, `[${bridge.id}]`) )
				.on('error', this.error.bind( this, `[${bridge.id}]`) )
				.on('bridge_available', () => {
					this.emit('bridge_available', bridgeId );
					this.emit('bridge_available_' + bridgeId, bridgeInstance );
				})
				.init()
	}

	getBridges() {
		return this._bridges;
	}

	getBridge( bridgeId ) {
		if( typeof bridgeId !== 'string' ) return new Error('invalid_bridge');
		return this._bridges[ bridgeId.toLowerCase() ] || new Error('invalid_bridge');
	}

	/*
		Export methods
	*/
	_onExportsInit() {

		console.log(`${Homey.manifest.id} running...`);

		this.findBridges();
		setInterval( this.findBridges.bind(this), findBridgesInterval );

	}

	/*
		Flow methods
	*/
	_onFlowActionSetScene( callback, args, state ) {

		let bridge = this.getBridge( args.scene.bridge_id );
		if( bridge instanceof Error ) return callback( bridge );

		bridge.setScene( args.scene.id )
			.then(() => {
				callback();
			})
			.catch( callback );

	}
	_onFlowActionSetSceneSceneAutocomplete( callback, args, state ) {

		if( Object.keys( this._bridges ).length < 1 )
			return callback( new Error( __("no_bridges") ) );

		let calls = [];

		for( let bridgeId in this._bridges ) {
			let bridge = this._bridges[ bridgeId ];

			let call = bridge.getScenes()
				.then((scenes) => {
					return {
						bridge: bridge,
						scenes: scenes
					}
				})
				.catch((err) => {
					this.error( err );
					return err;
				})
			calls.push( call );

		}

		Promise.all( calls ).then(( results ) => {

			let resultArray = [];

			results.forEach((result) => {
				if( result instanceof Error ) return;

				let bridge = result.bridge;
				result.scenes.forEach((scene) => {
					resultArray.push({
						bridge_id			: bridge.id,
						name				: scene.name.split(' on ')[0],
						id					: scene.id,
						description			: bridge.name,
						description_icon	: bridge.icon
					})
				});
			});

			resultArray = resultArray.filter(( resultArrayItem ) => {
				return resultArrayItem.name.toLowerCase().indexOf( args.query.toLowerCase() ) > -1;
			});

			callback( null, resultArray );
		});

	}

	_onFlowActionGroupOn( callback, args, state ) {

		let bridge = this.getBridge( args.group.bridge_id );
		if( bridge instanceof Error ) return callback( bridge );

		bridge.getGroup( args.group.id )
			.then(( group ) => {
				group.on = true;
				bridge.saveGroup( group )
					.then(() => {
						callback();

						let lights = bridge.getLights();
						let driver = Homey.manager('drivers').getDriver('bulb');

						for( let light of lights ) {

							if( group.lightIds.indexOf( light.id.toString() ) > -1 ) {
								light.on = true;
								driver.realtime( driver.getDeviceData( bridge, light ), 'onoff', true );
							}

						}

					})
					.catch( callback );
			})
			.catch( callback );

	}

	_onFlowActionGroupOff( callback, args, state ) {

		let bridge = this.getBridge( args.group.bridge_id );
		if( bridge instanceof Error ) return callback( bridge );

		bridge.getGroup( args.group.id )
			.then(( group ) => {
				group.on = false;
				bridge.saveGroup( group )
					.then(() => {
						callback();

						let lights = bridge.getLights();
						let driver = Homey.manager('drivers').getDriver('bulb');

						for( let light of lights ) {

							if( group.lightIds.indexOf( light.id.toString() ) > -1 ) {
								light.on = false;
								driver.realtime( driver.getDeviceData( bridge, light ), 'onoff', false );
							}

						}

					})
					.catch( callback );
			})
			.catch( callback );

	}

	_onFlowActionGroupAutocomplete( callback, args ) {

		if( Object.keys( this._bridges ).length < 1 )
			return callback( new Error( __("no_bridges") ) );

		let calls = [];

		for( let bridgeId in this._bridges ) {
			let bridge = this._bridges[ bridgeId ];

			let call = bridge.getGroups()
				.then((groups) => {
					return {
						bridge: bridge,
						groups: groups
					}
				})
				.catch((err) => {
					this.error( err );
					return err;
				})
			calls.push( call );

		}

		Promise.all( calls ).then(( results ) => {

			let resultArray = [];

			results.forEach((result) => {
				if( result instanceof Error ) return;

				let bridge = result.bridge;

				resultArray.push({
					bridge_id			: bridge.id,
					name				: __('all_lights'),
					id					: 0,
					description			: bridge.name,
					description_icon	: bridge.icon
				});

				result.groups.forEach((group) => {
					resultArray.push({
						bridge_id			: bridge.id,
						name				: group.name,
						id					: group.id,
						description			: bridge.name,
						description_icon	: bridge.icon
					})
				});

			});

			resultArray = resultArray.filter(( resultArrayItem ) => {
				return resultArrayItem.name.toLowerCase().indexOf( args.query.toLowerCase() ) > -1;
			});

			callback( null, resultArray );
		});

	}

}

module.exports = new App();