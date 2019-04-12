'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

const CAPABILITIES_MAP = {
  'onoff': 'on',
  'dim': 'bri',
  'light_hue': 'hue',
  'light_saturation': 'sat',
  'light_temperature': 'ct',
  'light_mode': 'colormode'
};

module.exports = class DeviceBulb extends HueDevice {
  
  onHueInit() {
    const capabilities = this.getCapabilities();
    this.registerMultipleCapabilityListener(capabilities, this.onMultipleCapabilities.bind(this));
  }
  
  onPoll({ device }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
     
    for( const capabilityId in CAPABILITIES_MAP ) {
      if( !this.hasCapability(capabilityId) ) continue;
      
      const propertyId = CAPABILITIES_MAP[capabilityId];
      const propertyValue = device.state[propertyId];
      const convertedValue = this.constructor.convert(capabilityId, 'get', propertyValue);
      
      if( this.getCapabilityValue('onoff') === false && capabilityId === 'dim' ) continue;
      this.setCapabilityValue(capabilityId, convertedValue).catch(err => {
        this.error(`Error setting capability ${capabilityId} to value ${convertedValue} (${propertyValue})`);
      });
    }
  }
  
  onRenamed(name) {
    if( !this.bridge ) return;
    
    const { id } = this;
    this.bridge.setLightName({
      id,
      name,
    }).catch(this.error);
  }
  
  async setLightState(state) {  
    return this.bridge.setLightState({
      state,
      id: this.id,
    });    
  }
  
  async onMultipleCapabilities(valueObj, optsObj) {
    //this.log('onMultipleCapabilities', valueObj, optsObj)
    
    const state = {
      effect: 'none',
      alert: 'none',
    };
    
    // Calculate capabilities  
    if( typeof valueObj.dim === 'number' ) {
      valueObj.onoff = valueObj.dim > 0;  
    }
        
    for( let capabilityId in CAPABILITIES_MAP ) {
      if( !this.hasCapability(capabilityId) ) continue;
      
      const propertyId = CAPABILITIES_MAP[capabilityId];
      let capabilityValue = valueObj[capabilityId];
      if( typeof capabilityValue === 'undefined' ) capabilityValue = this.getCapabilityValue(capabilityId);
      let convertedValue = this.constructor.convert(capabilityId, 'set', capabilityValue);
      
      // only send properties for the current light_mode, so the bulb switches accordingly
      const lightMode = valueObj['light_mode'] || this.getCapabilityValue('light_mode');
      if( lightMode === 'temperature' ) {
        if( capabilityId === 'light_hue' || capabilityId === 'light_saturation' ) convertedValue = null;
      } else if( lightMode === 'color' ) {
        if( capabilityId === 'light_temperature' ) convertedValue = null;
      }
            
      if( convertedValue === null ) continue;
      
      state[propertyId] = convertedValue;
      this.setCapabilityValue(capabilityId, capabilityValue).catch(this.error);
    }
    
    if(!Object.keys(state).length) return;
    
    // Add transition
    for( let key in optsObj ) {
      if( typeof optsObj[key].duration === 'number' ) {
        state['transitiontime'] = optsObj[key].duration / 100;
      }
    }
    
    return this.setLightState(state);
  }
  
  /*
   * Flow methods
   */
   
  async shortAlert() {
    return this.setLightState({
      alert: 'select',
    });
  }
  
  async longAlert() {
    return this.setLightState({
      alert: 'lselect',
    });
  }
  
  async startColorLoop() {
    await this.setLightState({
      on: true,
      effect: 'colorloop',
      alert: 'none',
    });
    await this.setCapabilityValue('onoff', true);
  }
  
  async stopColorLoop() {
    return this.setLightState({
      effect: 'none',
      alert: 'none',
    });
  }
  
  static convert( capabilityId, direction, value ) {
    if( capabilityId === 'onoff' ) {
      if( direction === 'get' ) {
        return value === true;
      } else if( direction === 'set' ) {
        return value === true;
      }
    } else if( capabilityId === 'dim' || capabilityId === 'light_saturation'  ) {      
      if( direction === 'get' ) {
        value = Math.max(0, value);
        value = Math.min(254, value);
        return value / 254;
      } else if( direction === 'set' ) {
        return Math.ceil( value * 254 );
      }
    } else if( capabilityId === 'light_hue' ) {      
      if( direction === 'get' ) {
        value = Math.max(0, value);
        value = Math.min(65535, value);
        return value / 65535;
      } else if( direction === 'set' ) {
        return Math.ceil( value * 65535 );
      }
    } else if( capabilityId === 'light_temperature' ) {      
      if( direction === 'get' ) {
        value = Math.max(153, value);
        value = Math.min(500, value);
        return ( value - 153 ) / ( 500 - 153 );
      } else if( direction === 'set' ) {
        return Math.ceil( 153 + value * ( 500 - 153 ) );
      }
    } else if( capabilityId === 'light_mode' ) {
      if( direction === 'get' ) {
        return ( value === 'ct' ) ? 'temperature' : 'color'
      } else if( direction === 'set' ) {
        return null;
      }
    } else {
      return value;
    }
  }
}