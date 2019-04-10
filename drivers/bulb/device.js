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
    for( const capabilityId in CAPABILITIES_MAP ) {
      if( !this.hasCapability(capabilityId) ) continue;
      
      const propertyId = CAPABILITIES_MAP[capabilityId];
      const propertyValue = device.state[propertyId];
      const convertedValue = this.constructor.convert(capabilityId, 'get', propertyValue);
      
      if( this.getCapabilityValue('onoff') === false && capabilityId === 'dim' ) continue;
      this.setCapabilityValue(capabilityId, convertedValue).catch(this.error);
    }
  }
  
  async onMultipleCapabilities(valueObj, optsObj) {
    //this.log('onMultipleCapabilities', valueObj, optsObj)
    
    const state = {};
    
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
    
    // Add transition
    for( let key in optsObj ) {
      if( typeof optsObj[key].duration === 'number' ) {
        state['transitionTime'] = optsObj[key].duration / 1000;
      }
    }
            
    return this.bridge.setLightState({
      state,
      id: this.id,
    });
  }
  
  shortAlert() {
    if( this._device instanceof Error )
      return Promise.reject(this._device);
      
    this._device.alert = 'select';
        
    return this._saveDevice();
  }
  
  longAlert() {
    if( this._device instanceof Error )
      return Promise.reject(this._device);
      
    this._device.alert = 'lselect';
        
    return this._saveDevice();
  }
  
  startColorLoop() {
    if( this._device instanceof Error )
      return Promise.reject(this._device);
      
    this._device.effect = 'colorloop';
    this._device.alert = 'none';
    
    return this._onCapabilitiesSet({
      onoff: true
    }, {});    
  }
  
  stopColorLoop() {
    if( this._device instanceof Error )
      return Promise.reject(this._device);
    
    this._device.effect = 'none';
    this._device.alert = 'none';
    
    return this._onCapabilitiesSet({
      onoff: true
    }, {});
  }
  
  setRandomColor() {
    if( this._device instanceof Error )
      return Promise.reject(this._device);

    const onoff = true;
    const light_saturation = 1;
    const light_hue = Math.random();
    const light_mode = 'color';
    
    this._device.effect = 'none';
    this._device.alert = 'none';
    
    return this._onCapabilitiesSet({
      onoff,
      light_saturation,
      light_hue,
      light_mode
    }, {});
    
  }

  brightnessIncrement( brightness, duration ) {
    if( this._device instanceof Error )
      return Promise.reject(this._device);
    
    const settingKey = 'notification_brightness_increment_deprecated';
    if( Homey.ManagerSettings.get(settingKey) !== true ) {
      Homey.ManagerSettings.set(settingKey, true);
      
      new Homey.Notification({
        excerpt: Homey.__('notification.brightness_increment_deprecated')
      })
        .register()
        .catch( this.error );
    }
    
    return this._onCapabilitiesSet({
      dim: brightness
    }, {
      dim: { duration }
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
        return value / 254;
      } else if( direction === 'set' ) {
        return Math.ceil( value * 254 );
      }
    } else if( capabilityId === 'light_hue' ) {
      if( direction === 'get' ) {
        return value / 65535;
      } else if( direction === 'set' ) {
        return Math.ceil( value * 65535 );
      }
    } else if( capabilityId === 'light_temperature' ) {
      if( direction === 'get' ) {
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