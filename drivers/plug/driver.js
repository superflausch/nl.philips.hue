'use strict';

const Homey = require('homey');
const HueDriver = require('../../lib/HueDriver.js');

const PLUG_MODEL_IDS = [
  'LOM001',
  'Plug 01',
];

module.exports = class DriverBulb extends HueDriver {
  
  static get HUE_TYPE() {
    return 'light';
  }
  
  static onPairGetDevices({ bridge }) {
    return bridge.getLights.bind(bridge);
  }
  
  static onPairListDevice({ bridge, device }) {
    bridge.log('Plug Device:', device.modelid, device.name);
    
    if( device.type !== 'On/Off plug-in unit' ) return null;
    return {};
  }
}