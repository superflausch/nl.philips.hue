'use strict';

const Homey = require('homey');
const HueDriver = require('../../lib/HueDriver.js');

const ICONS_MAP = {
	'SML001': 'SML001',
	'SML002': 'SML002',
}

module.exports = class DriverMotionSensor extends HueDriver {
  
  static get HUE_TYPE() {
    return 'sensor';
  }
  
  static onPairGetDevices({ bridge }) {
    return bridge.getSensors.bind(bridge);
  }
  
  static onPairListDevice({ bridge, device }) {
    bridge.log('Motion Sensor Device:', device.modelid, device.type, device.name);
    
    if( !['SML001', 'SML002'].includes(device.modelid)) return null;
    if( device.type !== 'ZLLPresence' ) return null;
    
    const obj = {};
    
    const icon = ICONS_MAP[device.modelid];
    if( icon ) obj.icon = `/icons/${icon}.svg`;
    
    return obj;
  }
  
  onInitFlow() {
    new Homey.FlowCardAction('enableMotionSensor')
      .register()
      .registerRunListener(async args => {
        return args.device.enableMotionSensor();
      });
      
    new Homey.FlowCardAction('disableMotionSensor')
      .register()
      .registerRunListener(async args => {
        return args.device.disableMotionSensor();
      });
  }
}