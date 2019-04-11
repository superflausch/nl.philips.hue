'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

const BUTTON_EVENT_MAP = {
	'1': 'on',
	'2': 'increase_brightness',
	'3': 'decrease_brightness',
	'4': 'off',
};

module.exports = class DeviceDimmerSwitch extends HueDevice {
    
  onPoll({ device }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
    if(!device.config) return;
        
    // Use only the first digit, it's mapped to the button
    // The fourth digit seems to be some type of event
    if( typeof device.state.buttonevent !== 'undefined' )
      device.state.buttonevent = String(device.state.buttonevent).substring(0,1);
		
		this.setCapabilityValue('measure_battery', parseInt(device.config.battery)).catch(this.error);
        
    // Initial load, don't trigger a Flow when the app has just started
    if( typeof this.buttonevent === 'undefined' ) {
      this.buttonevent = device.state.buttonevent;
      this.lastupdated = device.state.lastupdated;
    } else {

      // if last press changed and button is the same
      if( device.state.lastupdated !== this.lastupdated && device.state.buttonevent === this.buttonevent ) {
        this.lastupdated = device.state.lastupdated;
        
        const button = BUTTON_EVENT_MAP[device.state.buttonevent];
        this.log(`Same button pressed [${device.state.buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerDimmerSwitchButtonPressed.trigger(this, {}, { button }).catch(this.error);
        }
      }

      // else if the button has changed
      else if( this.buttonevent !== device.state.buttonevent ) {
        this.buttonevent = device.state.buttonevent;
        this.lastupdated = device.state.lastupdated;
        
        const button = BUTTON_EVENT_MAP[device.state.buttonevent];
        this.log(`New button pressed [${device.state.buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerDimmerSwitchButtonPressed.trigger(this, {}, { button }).catch(this.error);
        }
      }
    }
  }
  
}