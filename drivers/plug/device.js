'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

const CAPABILITIES_MAP = {
  'onoff': 'on',
};

module.exports = class DevicePlug extends HueDevice {
  
  onHueInit() {
    const capabilities = this.getCapabilities();
    this.log('Capabilities:', capabilities.join(', '));
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
  }
  
  onPoll({ device }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
     
    for( const capabilityId in CAPABILITIES_MAP ) {
      if( !this.hasCapability(capabilityId) ) continue;
      
      const propertyId = CAPABILITIES_MAP[capabilityId];
      const propertyValue = device.state[propertyId];
      
      if( propertyId === 'on' )
        this.setCapabilityValue('onoff', propertyValue).catch(this.error);
    }
    
    // cleanup
    device = null;
  }
  
  async onCapabilityOnOff(value) {    
    return this.bridge.setLightState({
      state: {
        on: !!value,
      },
      id: this.id,
    });   
  }
}