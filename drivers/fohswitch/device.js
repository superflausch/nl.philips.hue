'use strict';

const Homey = require('homey');
const HueDevice = require('../../lib/HueDevice.js');

const BUTTON_SHORT_EVENT_MAP = {
	'20': 'top_left',
	'21': 'bottom_left',
  '22': 'bottom_right',
  '23': 'top_right',
  '99': 'bottom_left_right',
  '101': 'top_left_right',
};

const BUTTON_LONG_EVENT_MAP = {
	'16': 'top_left',
	'17': 'bottom_left',
  '18': 'bottom_right',
  '19': 'top_right',
  '98': 'bottom_left_right',
  '100': 'top_left_right',
};


module.exports = class DeviceFOHSwitch extends HueDevice {
    
  onPoll({ device }) {   
    super.onPoll(...arguments);
    if(!device.state) return;
    if(!device.config) return;
	
    //map hue json values to a variable
    let lastupdated = device.state.lastupdated;
    let buttonevent = device.state.buttonevent;
    let epochMili = new Date(lastupdated).getTime();
            
    // Initial load, don't trigger a Flow when the app has just started
    if( typeof this.buttonevent === 'undefined' ) {
      this.buttonevent = buttonevent;
      this.lastupdated = lastupdated;
      this.epochMili = epochMili;
    } else {
/*
      const button = BUTTON_LONG_EVENT_MAP[buttonevent];
      this.log(`[${this.lastupdated}]${epochMili} Button pressed [${buttonevent}]:`, button);
*/
      // button short pressed
      if( (buttonevent >= 20 && buttonevent <= 23 || buttonevent === 99 ||  buttonevent === 101) && this.lastupdated !== lastupdated ) {
        // last event was a long press (hold), so it could be the release of a button if the press duration wasn't more than 7 seconds
        if ((this.buttonevent >= 16 && this.buttonevent <= 19 || this.buttonevent === 98 ||  this.buttonevent === 100 ) && ((epochMili - this.epochMili) < 7000 ))  {
          this.buttonevent = buttonevent;
          this.lastupdated = lastupdated;
          this.epochMili = epochMili;

          const button = BUTTON_SHORT_EVENT_MAP[buttonevent];
          this.log(`[${this.lastupdated}] ${epochMili/1000} Button long released [${buttonevent}]:`, button);

          if( button ) {
            this.driver.flowCardTriggerFOHSwitchButtonLongReleased
              .trigger(this, {}, { button })
              .catch(this.error);
          }
        } else {
          this.buttonevent = buttonevent;
          this.lastupdated = lastupdated;
          this.epochMili = epochMili;
          
          const button = BUTTON_SHORT_EVENT_MAP[buttonevent];
          this.log(`[${this.lastupdated}] ${epochMili/1000} Button short pressed [${buttonevent}]:`, button);
          
          if( button ) {
            this.driver.flowCardTriggerFOHSwitchButtonShortPressed
              .trigger(this, {}, { button })
              .catch(this.error);
          }
        }
      // button long pressed (hold)
      } else if( (buttonevent >= 16 && buttonevent <= 19 || buttonevent === 98 ||  buttonevent === 100) && this.lastupdated !== lastupdated) {
        this.buttonevent = buttonevent;
        this.lastupdated = lastupdated;
        this.epochMili = epochMili;
        
        const button = BUTTON_LONG_EVENT_MAP[buttonevent];
        this.log(`[${this.lastupdated}] ${epochMili/1000} Button long pressed [${buttonevent}]:`, button);
        
        if( button ) {
          this.driver.flowCardTriggerFOHSwitchButtonLongPressed
            .trigger(this, {}, { button })
            .catch(this.error);
        }
      } 
      
    }
    
    // cleanup
    device = null;
    buttonevent = null;
    lastupdated = null;
    epochMili = null;
  }
  
}