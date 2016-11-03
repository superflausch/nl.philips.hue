'use strict';

const events	= require('events');
const huejay 	= require('huejay');
const _			= require('underscore');

const pollInterval = 7500;

class Bridge extends events.EventEmitter {

	constructor( id, address ) {
		super();

		this._debug 	= true;

		this.id 		= id;
		this.address 	= address;
		this.name 		= undefined;
		this.modelId 	= undefined;
		this.modelName 	= undefined;
		this.icon		= undefined;

		this._lights	= {};

		this._client = new huejay.Client({
			host		: this.address
		});

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
		Homey.app.log.bind( Homey.app, `[log][${this.constructor.name}][${this.id}]` ).apply( Homey.app, arguments );
	}

	error() {
		Homey.app.error.bind( Homey.app, `[err][${this.constructor.name}][${this.id}]` ).apply( Homey.app, arguments );
	}

	/*
		Public methods
	*/
	init( callback ) {
		this.debug('init');

		callback = callback || function(){}

		this._token = Homey.manager('settings').get( `bridge_token_${this.id}` );
		this._client = new huejay.Client({
			host		: this.address,
			username	: this._token
		});

		// get bridge info
		this._client.bridge.get()
			.then((bridge) => {
				this.name = bridge.name;
				this.modelId = bridge.modelId;
				this.modelName = bridge.model.name;
				this.icon = `/app/${Homey.manifest.id}/assets/images/bridges/${this.modelId}.svg`;
			})

		// get devices and test authentication
		if( !this._token )
			return callback();

		// set refresh interval
		if( this._refreshInterval ) clearInterval(this._refreshInterval);
		this._refreshInterval = setInterval( this._refreshDevices.bind(this), pollInterval);

		// get bridge data
		this._testAuthentication( ( err ) => {
			if( err ) return callback( err );

			this._refreshDevices(( err ) => {
				if( err ) return callback( err );
				this.emit('bridge_available');
				callback();
			});
		});
	}

	isAuthenticated() {
		return typeof this._token === 'string';
	}

	register( callback ) {
		this.debug('register');

		callback = callback || function(){}

		let user = new this._client.users.User;
			user.deviceType = 'homey';

		this._client.users.create( user )
			.then((user) => {
				Homey.manager('settings').set( `bridge_token_${this.id}`, user.username );
				this.init( callback );
			})
			.catch( callback );
	}

	/*
		Scenes methods
	*/
	getScenes() {
		return this._client.scenes.getAll();
	}

	setScene( scene ) {
		return this._client.scenes.recall( scene );
	}

	/*
		Group methods
	*/
	getGroups() {
		return this._client.groups.getAll();
	}

	getGroup( groupId ) {
		return this._client.groups.getById( groupId );
	}

	saveGroup( group ) {
		return this._client.groups.save( group );
	}

	/*
		Lights methods
	*/
	getLights() {
		return this._lights;
	}

	getLight( lightId ) {
		return _.findWhere( this._lights, { uniqueId: lightId }) || new Error('invalid_light');
	}

	saveLight( light ) {
		return this._client.lights.save( light );
	}

	/*
		Sensor methods
	*/
	getSensors() {
		return this._sensors;
	}

	getSensor( sensorId ) {
		return _.findWhere( this._sensors, { uniqueId: sensorId }) || new Error('invalid_sensor');
	}

	/*
		Private methods
	*/

	_testAuthentication( callback ) {
		this.debug('_testAuthentication');

		callback = callback || function(){}

		this._client.bridge.isAuthenticated()
			.then(() => {
				callback();
			})
			.catch((err) => {
				this._token = undefined;
				Homey.manager('settings').unset( `bridge_token_${this.id}` );
				callback( err );
			});
	}

	_refreshDevices( callback ) {
		this.debug('_refreshDevices');

		callback = callback || function(){}

		var getLights = this._client.lights.getAll()
			.then((lights) => {
				this._lights = lights;
			})

		var getSensors = this._client.sensors.getAll()
			.then((sensors) => {
				this._sensors = sensors;
			})

		Promise.all([ getLights, getSensors ])
			.then(( result ) => {
				this.emit('refresh');
				callback();
			})
			.catch( callback )
	}

}

module.exports = Bridge;