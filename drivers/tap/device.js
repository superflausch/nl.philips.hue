'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

const BUTTON_EVENT_MAP = {
  '34': 'button1',
  '16': 'button2',
  '17': 'button3',
  '18': 'button4',  
}

module.exports = class DeviceTap extends HueDevice {
    
  onPoll({ device }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
        
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
          this.driver.flowCardTriggerTapButtonPressed
            .trigger(this, {}, { button })
            .catch(this.error);
        }
      }

      // else if the button has changed
      else if( this.buttonevent !== device.state.buttonevent ) {
        this.buttonevent = device.state.buttonevent;
        this.lastupdated = device.state.lastupdated;
        
        const button = BUTTON_EVENT_MAP[device.state.buttonevent];
        this.log(`New button pressed [${device.state.buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerTapButtonPressed
            .trigger(this, {}, { button })
            .catch(this.error);
        }
      }
    }
  }
  
}