'use strict';

const Homey = require('homey');
const HueDriver = require('../../lib/HueDriver.js');

module.exports = class DriverDimmerSwitch extends HueDriver {
  
  static get HUE_TYPE() {
    return 'sensor';
  }
  
  static onPairGetDevices({ bridge }) {
    return bridge.getSensors.bind(bridge);
  }
  
  static onPairListDevice({ bridge, device }) {
    bridge.log('Dimmer Switch Device:', device.modelid, device.name);
    
    if( !['RWL020', 'RWL021'].includes(device.modelid)) return null;
    return {};
  }
  
  onInitFlow() {
    this.flowCardTriggerDimmerSwitchButtonPressed = new Homey.FlowCardTriggerDevice('dimmerswitch_button_pressed')
      .register()
      .registerRunListener(async ( args, state ) => {
        return args.button === state.button;
      });
  }
}