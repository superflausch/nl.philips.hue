'use strict';

const Homey = require('homey');

module.exports = class HueDriver extends Homey.Driver {
  
  static get HUE_TYPE() {
    return 'light';
  }
  
  onInit() {
    this.onInitFlow();
  }
  
  onInitFlow() {
    // Overload me
  }
  
  onPair( socket ) {    
    const bridges = Homey.app.getBridges();
    let bridge;
    let pollInterval;
      
    const onCheckAuthentication = () => {
      if( bridge && bridge.authenticated ) {
        socket.showView('list_devices');
      } else {
        socket.showView('authenticate');
      }
    }
      
    const onListBridgesSelection = async ( data ) => {
      bridge = bridges[data[0].data.id];
    }
      
    const onListBridges = async () => {
      const devices = Object.values(bridges).filter(bridge => {
        return bridge.connected;
      }).map(bridge => {
        return {
          name: bridge.name,
          icon: bridge.icon,
          data: {
            id: bridge.id,
          },
        }
      });
      
      // Skip selection if only one bridge
      if( devices.length === 1 ) {
        bridge = bridges[0];
        socket.showView('check_authentication')
      }
      
      return devices;
    }
      
    const onListDevices = async () => {
      const fn = this.constructor.onPairGetDevices({ bridge });
      const devices = await fn();
      
      return Object.values(devices).map(device => {
        try {
          return {          
            name: device.name,
            data: {
              id: device.uniqueid,
              bridge_id: bridge.id,
            },
            ...this.constructor.onPairListDevice({ bridge, device }),
          }
        } catch( err ) {
          this.error(err);
          return null;
        }
      }).filter(device => !!device);
    }
      
    const onAuthenticate = async () => {
      pollInterval = setInterval(() => {
        this.log('Try createUser...');
        bridge.createUser().then(token => {
          clearInterval(pollInterval);
          
          bridge.token = token;
          Homey.ManagerSettings.set(`bridge_token_${bridge.id}`, token);
          
          return bridge.init();
        }).then(() => {          
          return socket.showView('list_devices');
        }).catch(err => {
          if( err.type === 101 || err.message === 'link button not pressed' ) return;
          
          this.error(err);
          socket.emit('error', err.message || err.toString());
        });
      }, 1000);
    }
    
    const onDisconnect = () => {
      if( pollInterval )
        clearInterval(pollInterval);
    }
    
    socket
      .on('showView', ( viewId, callback ) => {
        callback();
        if( viewId === 'check_authentication' )
          return onCheckAuthentication();
        
        if( viewId === 'authenticate' )
          return onAuthenticate();          
      })
      .on('list_devices', ( data, callback ) => {
        Promise.resolve().then(() => {
          if( bridge ) return onListDevices( data );
          return onListBridges( data );
        })
          .then(result => callback(null, result))
          .catch(err => callback(err));
      })
      .on('list_bridges_selection', ( data, callback ) => {
        return onListBridgesSelection( data )
          .then(result => callback(null, result))
          .catch(err => callback(err));
      })
      .on('disconnect', ( data ) => {
        onDisconnect();
      })
    
  }
  
  onPairGetDevices({ bridge }) {
    throw new Error('Overload Me');
  }
  
  onPairListDevice({ bridge, device }) {
    return {}; // Overload me
  }
	
	/*
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
	*/

}