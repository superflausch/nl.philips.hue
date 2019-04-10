'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

const buttonEventMap = {
	'34': 'button1',
	'16': 'button2',
	'17': 'button3',
	'18': 'button4'
}

class DeviceTap extends Device {
	
	onInit() {
		super.onInit();
		
		this._buttonEvent = undefined;
		this._lastUpdated = undefined;
		
		this._driver = this.getDriver();
		
	}
	
	_onSync() {	
		super._onSync();
		
		const lastUpdated = this._device.state.lastUpdated;
		const buttonEvent = this._device.state.buttonEvent;
		
		if( typeof this._buttonEvent === 'undefined' ) {
			this._buttonEvent = this._device.state.buttonEvent;
			this._lastUpdated = this._device.state.lastUpdated;
		} else {

			// if last press changed and button is the same
			if( lastUpdated !== this._lastUpdated && buttonEvent === this._buttonEvent ) {
				this._lastUpdated = lastUpdated;
				
				this._driver.flowCardTrigger.trigger(this, null, {
					button: buttonEventMap[buttonEvent]
				}).then(this.log).catch( this.error );

			}

			// else if the button has changed
			else if( this._buttonEvent !== buttonEvent ) {
				this._buttonEvent = buttonEvent;
				this._lastUpdated = lastUpdated;

				this._driver.flowCardTrigger.trigger(this, null, {
					button: buttonEventMap[buttonEvent]
				}).catch( this.error );

			}
		}
	}
}

module.exports = DeviceTap;