'use strict';

const Homey = require('homey');

const CAPABILITIES_SET_DEBOUNCE = 100;

module.exports = class HueDevice extends Homey.Device {
  
  onInit() {
    this.setUnavailable(Homey.__('loading'));
    
    this.onPoll = this.onPoll.bind(this);
    
    const {
      id: uniqueid,
      bridge_id: bridgeid,
    } = this.getData();
    
    this.id = null;
    this.uniqueid = uniqueid;
    this.bridgeid = bridgeid;
    this.driver = this.getDriver();
    
    Homey.app.getBridge(this.bridgeid)
      .then(bridge => {
        this.log('Found bridge');
        this.bridge = bridge;
        this.id = this.bridge.registerDevice({
          uniqueid,
          type: this.driver.constructor.HUE_TYPE,
          onPoll: this.onPoll.bind(this),
          onError: this.onError.bind(this),
        });
        
        this.setAvailable().catch(this.error);
        this.onHueInit();
      })
      .catch(err => {
        this.error(err);
        this.setUnavailable(err).catch(this.error);
      })
    
  }
  
  onHueInit() {
    // Overload Me
  }
  
  onDeleted() {  
    if( !this.bridge ) return;
    
    const { uniqueid } = this;
    this.bridge.unregisterDevice({
      uniqueid,
    });
  }
  
  onPoll({ device }) {
    this.setAvailable().catch(this.error);
  }
  
  onError(err) {
    this.setUnavailable(err).catch(this.error);
  }
}