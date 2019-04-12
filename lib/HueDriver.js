'use strict';

const Homey = require('homey');

module.exports = class HueDriver extends Homey.Driver {
  
  onInit() {
    this.onInitFlow();
  }
  
  onInitFlow() {
    // Overload me
  }
  
  onPair( socket ) {    
    const bridges = Homey.app.bridges;
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
        const obj = this.constructor.onPairListDevice({ bridge, device });
        if( obj === null ) return null;
        
        return {          
          name: device.name,
          data: {
            id: device.uniqueid,
            bridge_id: bridge.id,
          },
          ...obj,
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

}