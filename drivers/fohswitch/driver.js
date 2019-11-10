'use strict';

const Homey = require('homey');
const HueDriver = require('../../lib/HueDriver.js');

module.exports = class DriverFOHSwitch extends HueDriver {
  
  static get HUE_TYPE() {
    return 'sensor';
  }
  
  static onPairGetDevices({ bridge }) {
    return bridge.getSensors.bind(bridge);
  }
  
  static onPairListDevice({ bridge, device }) {
    bridge.log('Friends of Hue Switch Device:', device.modelid, device.name);
    
    if( !['FOHSWITCH'].includes(device.modelid)) return null;
    return {};
  }
  
  onInitFlow() {
    this.flowCardTriggerFOHSwitchButtonShortPressed = new Homey.FlowCardTriggerDevice('fohswitch_button_short_pressed')
      .register()
      .registerRunListener(async ( args, state ) => {
        return args.button === state.button;
      });
    
    this.flowCardTriggerFOHSwitchButtonLongPressed = new Homey.FlowCardTriggerDevice('fohswitch_button_long_pressed')
      .register()
      .registerRunListener(async ( args, state ) => {
        return args.button === state.button;
      });
    
    this.flowCardTriggerFOHSwitchButtonLongReleased = new Homey.FlowCardTriggerDevice('fohswitch_button_long_released')
      .register()
      .registerRunListener(async ( args, state ) => {
        return args.button === state.button;
      });
  }
}