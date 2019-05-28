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
		
		const battery = parseInt(device.config.battery);
		if( typeof battery === 'number')
  		this.setCapabilityValue('measure_battery', battery).catch(this.error);
      
    // Use only the first digit, it's mapped to the button
    // The fourth digit seems to be some type of event
    let lastupdated = device.state.lastupdated;
    let buttonevent = device.state.buttonevent;
    
    if( typeof buttonevent !== 'undefined' )
      buttonevent = String(buttonevent).substring(0,1);
            
    // Initial load, don't trigger a Flow when the app has just started
    if( typeof this.buttonevent === 'undefined' ) {
      this.buttonevent = buttonevent;
      this.lastupdated = lastupdated;
    } else {

      // if last press changed and button is the same
      if( lastupdated !== this.lastupdated && buttonevent === this.buttonevent ) {
        this.lastupdated = lastupdated;
        
        const button = BUTTON_EVENT_MAP[buttonevent];
        this.log(`Same button pressed [${buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerDimmerSwitchButtonPressed
            .trigger(this, {}, { button })
            .catch(this.error);
        }
      }

      // else if the button has changed
      else if( this.buttonevent !== buttonevent ) {
        this.buttonevent = buttonevent;
        this.lastupdated = lastupdated;
        
        const button = BUTTON_EVENT_MAP[buttonevent];
        this.log(`New button pressed [${buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerDimmerSwitchButtonPressed
            .trigger(this, {}, { button })
            .catch(this.error);
        }
      }
    }
    
    // cleanup
    device = null;
    buttonevent = null;
    lastupdated = null;
  }
  
}