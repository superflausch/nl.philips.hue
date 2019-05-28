'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

module.exports = class DeviceMotionSensor extends HueDevice {
    
  onPoll({ device, state }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
    if(!device.config) return;
    
    this.setCapabilityValue('measure_battery', parseInt(device.config.battery)).catch(this.error);
    this.setCapabilityValue('alarm_motion', device.state.presence).catch(this.error);
    
    // Find subdevices
    Object.values(state.sensors).filter(sensor => {
      if(!['SML001', 'SML002'].includes(sensor.modelid))
        return false;
        
      if(this.constructor.getMAC(sensor.uniqueid) !== this.constructor.getMAC(this.uniqueid))
        return false;
      
      if(!sensor.state)
        return false;
        
      return true;
    }).forEach(sensor => {
      if( sensor.type === 'ZLLLightLevel' ) {
        if( typeof sensor.state.lightlevel !== 'number' )
          return this.setCapabilityValue('measure_luminance', null);
        
        const lightlevel = Math.pow( 10, ( sensor.state.lightlevel - 1 ) / 10000 );
        this.setCapabilityValue('measure_luminance', lightlevel).catch(this.error);
      } else if( sensor.type === 'ZLLTemperature' ) {
        if( typeof sensor.state.temperature !== 'number' )
          return this.setCapabilityValue('measure_temperature', null);
          
        const temperature = parseFloat(sensor.state.temperature) / 100;
        this.setCapabilityValue('measure_temperature', temperature).catch(this.error);
      }
    });
    
    // cleanup
    device = null;
    state = null;
  }
  
  async enableMotionSensor() {
    const { id } = this;
    
    return this.bridge.setSensorConfig({
      id,
      config: {
        on: true,
      },
    });
  }
  
  async disableMotionSensor() {
    const { id } = this;
    
    return this.bridge.setSensorConfig({
      id,
      config: {
        on: false,
      },
    });
  }

  static getMAC( str ) {
    return str.split('-')[0].toLowerCase();
  }
  
}