'use strict';

const Homey = require('homey');
const huejay = require('huejay');

const POLL_INTERVAL = 5000;

class Bridge extends Homey.SimpleClass {
	
	constructor( id, address ) {
		super();

		this.setMaxListeners(0);

		this.id = id.toLowerCase();
		this.address = address;
		this.name = undefined;
		this.modelId = undefined;
		this.modelName = undefined;
		this.icon = undefined;

		this._token = undefined;
		this._lights = {};
		this._sensors = {};
		
	}
	
	init() {
		this.log('init');

		this._token = this._getToken();
		this._client = new huejay.Client({
			host		: this.address,
			username	: this._token
		});
		
		return this._client.bridge.get()
			.then(bridge => {
				this.name = bridge.name;
				this.modelId = bridge.modelId;
				this.modelName = bridge.model.name;
				this.icon = `/app/${Homey.manifest.id}/assets/images/bridges/${this.modelId}.svg`;	

				if( !this.isAuthenticated() )
					throw new Error('no_token');
		
				if( this._refreshInterval ) clearInterval(this._refreshInterval);
					this._refreshInterval = setInterval( this._refreshDevices.bind(this), POLL_INTERVAL);
				
				return this._testAuthentication();
	
			})
			.then(() => {
				return this._refreshDevices();
			})
			.then(() => {
				this.log('Available');
				this.emit('available');				
			});
	}

	_getToken() {

		let token = undefined;
		let keys = Homey.ManagerSettings.getKeys();
		
		keys.forEach(( key ) => {			
			if( key.toLowerCase() === `bridge_token_${this.id}`.toLowerCase() ) {
				token = Homey.ManagerSettings.get( key );
			}
		});

		return token;

	}
	
	_setToken( token ) {
		if( token === undefined ) {
			Homey.ManagerSettings.unset( `bridge_token_${this.id}` );
		} else {
			Homey.ManagerSettings.set( `bridge_token_${this.id}`, token );		
		}
		this._token = token;
	}
	
	getAddress() {
		return this.address;
	}

	setAddress( address ) {
		this.address = address;

		if( this._client ) {
			this._client.host = address;
		}
	}

	isAuthenticated() {
		return typeof this._token === 'string';
	}

	register() {
		let user = new this._client.users.User;
			user.deviceType = 'homey';

		return this._client.users.create( user )
			.then((user) => {
				this._setToken(user.username);
				return this.init();
			});
	}
	
	_testAuthentication() {
		return this._client.bridge.isAuthenticated()
			.catch(err => {
				this._setToken( undefined );
				throw err;
			});		
	}
	
	_refreshDevices() {
		const getLights = this._client.lights.getAll()
			.then(lights => {
				this._lights = {};
				lights.forEach(light => {
					this._lights[light.uniqueId] = light;
				});
			});

		const getSensors = this._client.sensors.getAll()
			.then(sensors => {
				this._sensors = {};
				sensors.forEach(sensor => {
					this._sensors[sensor.uniqueId] = sensor;
				});
			});

		return Promise.all([ getLights, getSensors ])
			.then(result => {
				this.emit('sync');
			});
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
		return this._lights[lightId] || new Error('invalid_light');
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
		return this._sensors[sensorId] || new Error('invalid_sensor');
	}

	saveSensor( sensor ) {
		return this._client.sensors.save( sensor );
	}
	

}

module.exports = Bridge;