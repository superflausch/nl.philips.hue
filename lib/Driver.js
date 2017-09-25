'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {
	
	onInit() {
		this.log('onInit', this.constructor.name);
		
		
	}
	
	onPair( socket ) {
		this.log('_onPair');

		let state = {
			connected	: true,
			bridge		: undefined
		};

		socket
			.on('select_bridge', ( data, callback ) => {

				let result = [];
				let bridges = Homey.app.getBridges();
				
				for( let bridgeId in bridges ) {
					let bridge = bridges[ bridgeId ];
										
					if( typeof bridge.modelId === 'undefined' ) {
						this.log('Skipping bridge due to undefined modelId', bridge);
						continue;
					}
					
					result.push({
						id		: bridgeId,
						name	: bridge.name || bridge.address,
						icon	: bridge.icon
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
						state.bridge.register()
							.then(result => {
								socket.emit('authenticated');								
							})
							.catch(err => {
								if( err && err.type === 101 && state.connected ) return register();
								if( err ) return register();
							});
					}, 1000);
				}

			})
			.on('list_devices', ( data, callback ) => {
				if( this._onPairListDevices ) {
					this._onPairListDevices( state, data, callback );
				} else {
					callback( new Error('missing _onPairListDevices') );
				}
			})
			.on('disconnect', () => {
				state.connected = false;
			})
			
	}

	getDeviceData( bridge, device ) {
		return {
			id			: device.uniqueId,
			bridge_id	: bridge.id
		}
	}

}

module.exports = Driver;