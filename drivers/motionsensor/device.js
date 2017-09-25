'use strict';

const Homey = require('homey');
const Device = require('../../lib/Device.js');

class DeviceMotionSensor extends Device {
	
	enable() {
		if( this._device instanceof Error )
			return Promise.reject(this._device);
			
		this._device.config.on = true;
		return this._saveDevice();
		
	}
	
	disable() {
		if( this._device instanceof Error )
			return Promise.reject(this._device);
			
		this._device.config.on = false;
		return this._saveDevice();
		
	}
	
	_onSync() {	
		super._onSync();
						
		this.setCapabilityValue('alarm_motion', this._device.state.presence);
		this.setCapabilityValue('measure_battery', parseInt(this._device.config.battery));

		const sensors = this._bridge.getSensors();
		for( let sensorId in sensors ) {
			let sensor = sensors[sensorId];
			if( sensor.modelId !== 'SML001' ) continue;

			if( DeviceMotionSensor.getMAC(sensor.uniqueId) === DeviceMotionSensor.getMAC(this._deviceId) ) {

				if( sensor.type === 'ZLLLightLevel' ) {
					let lightLevel = Math.pow( 10, ( sensor.state.lightLevel - 1 ) / 10000 );
					this.setCapabilityValue('measure_luminance', lightLevel);
				} else if( sensor.type === 'ZLLTemperature' ) {
					this.setCapabilityValue('measure_temperature', sensor.state.temperature);
				}

			}

		}
	}

	static getMAC( str ) {
		return str.split('-')[0].toLowerCase();
	}
}

module.exports = DeviceMotionSensor;