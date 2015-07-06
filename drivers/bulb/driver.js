"use strict";

var self = {
	
	philips: {
		hue: undefined,
		api: undefined,
		bridge: undefined
	},
	bulbs: {},
		
	init: function( devices, callback ){		
		self.philips.hue = require("node-hue-api");
		self.refresh();
		callback();
	},
	
	refresh: function( callback ) {
	
		var api_key = Homey.settings.api_key;

		// find the bridge
		self.philips.hue
			.nupnpSearch() // TODO: fallback to upnpSearch. Didn't work on my network tho
			.then(function(bridges) {
				
				if( bridges.length < 1 ) {
					Homey.error('no bridges found');
					return;
				}
				
				Homey.log('found bridge(s)', bridges[0].ipaddress);
				
				var bridge = bridges[0];
	
				self.philips.bridge = bridge;
				
				var username = api_key || '';
				
				self.philips.api = new self.philips.hue.HueApi(self.philips.bridge.ipaddress, username);
				
				self.philips.api
					.lights()
					.then(function( result ) {
												
						result.lights.forEach(function(light){
							
							if( typeof self.bulbs[ light.id ] != 'undefined' ) return;
							
							self.bulbs[ light.id ] = {
								id: light.id,
								name: light.name,
								state: {
									on:				false,
									hue:			false,
									saturation: 	1.0,
									brightness:		1.0,
									temperature: 	0.5
								},
								updateTimeout: setTimeout("", 0)
							};
							
							// set light status
							self.philips.api.lightStatus(light.id)
							    .then(function(status){
									var bulb = self.bulbs[ light.id ];
									
									bulb.state.onoff 			= status.state.on;
									bulb.state.brightness 		= (status.state.bri+1) / 255;
									
									if( status.state.colormode == 'hs' ) {
										bulb.state.hue 			= status.state.hue / 65535;										
										bulb.state.temperature 	= false;
									} else if( status.state.colormode == 'ct' ) {
										bulb.state.temperature 	= (status.state.ct-154)/(500-154);
										bulb.state.hue 			= false;
									}
							    })
							    .done();
							
							Homey.log(light.name + ' (id: ' + light.id + ')');
							
						});
						
					});
				
				if( typeof callback == 'function' ) {
					callback();
				}
			})
			.done();
		
	},
	
	getBulb: function( id ) {
		if( typeof self.bulbs[id] == 'undefined' ) return new Error("bulb is not connected (yet)");
		return self.bulbs[id];
	},
	
	update: function( id ){
				
		var bulb = self.getBulb( id );
					
		var state = self.philips.hue.lightState.create();
					
		if( bulb.state.onoff ) {
			state.on();
			
			if( bulb.state.temperature ) {				
				state.white(
					153 + bulb.state.temperature * 400,
					bulb.state.brightness * 100
				)
			} else {
				state.hsl(
					Math.floor( bulb.state.hue * 360 ),
					Math.floor( bulb.state.saturation * 100 ),
					Math.floor( bulb.state.brightness * 100 )
				);
			}
			
		} else {
			state.off();
		}
		
		clearTimeout(bulb.updateTimeout);
		bulb.updateTimeout = setTimeout(function(){
			self.philips.api.setLightState( id, state );
			
			// emit event to realtime listeners
			[ 'onoff', 'hue', 'saturation', 'brightness', 'temperature' ].forEach(function(capability){
				module.exports.realtime({
					id: id
				}, capability, self.getBulb( id ).state[capability]);				
			});
			
		}, 150);
		
	},
	
	renamed: function( name, callback ) {
		console.log('renamed', name, callback)
	},
	
	deleted: function( name, callback ) {
		console.log('deleted', callback)
	},
	
	capabilities: {
		
		onoff: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( bulb.state.onoff );
			},
			set: function( device, onoff, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
								
				bulb.state.onoff = onoff;
				self.update( device.id );
								
				callback( bulb.state.onoff );
			}
		},
		
		hue: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
							
				callback( bulb.state.hue );
			},
			set: function( device, hue, callback ) {			
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
							
				bulb.state.hue = hue;
				bulb.state.temperature = false;
				self.update( device.id );
				
				callback( bulb.state.hue );
			}
		},
		
		saturation: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
							
				callback( bulb.state.saturation );
			},
			set: function( device, saturation, callback ) {			
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
							
				bulb.state.saturation = saturation;
				bulb.state.temperature = false;
				self.update( device.id );
				
				callback( bulb.state.saturation );
			}
		},
		
		brightness: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( bulb.state.brightness );
			},
			set: function( device, brightness, callback ){
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
				
				bulb.state.brightness = brightness;
				self.update( device.id );
				
				callback( bulb.state.brightness );
			}
		},
		
		temperature: {
			get: function( device, callback ) {
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( bulb.state.temperature );
			},
			set: function( device, temperature, callback ) {
				var bulb = self.getBulb( device.id );
				if( bulb instanceof Error ) return callback( bulb );
	
				bulb.state.hue = false;
				bulb.state.temperature = temperature;
				self.update( device.id );
				
				callback( bulb.state.temperature );
			}
		}
	
	},
	
	pair: {
		press_button: function( callback, emit, data ){
						
			Homey.log('Hue bridge pairing has started');
			
			function tryRegisterUser(){
			
				self.philips.api.registerUser(self.philips.bridge.ipaddress, null, 'Homey')
				    .then(function( access_token ){
					    Homey.log('Pair button pressed', access_token);
						Homey.settings.api_key = access_token;
						self.refresh();
					    emit('button_pressed');
				    })
				    .fail(function( error ){
					    setTimeout(tryRegisterUser, 250);
				    })
				    .done();
				
			}
			
			tryRegisterUser();
			
		},
		list_devices: function( callback, emit, data ) {
						
			// TODO
			var devices = Object
				.keys(self.bulbs)
				.map(function(bulb_id){
					return {
						data: {
							id: bulb_id
						},
						name: self.bulbs[bulb_id].name
					};
				});
			
			callback( devices );
			
		},
		pair: function( callback, emit, data ) {
			
		}
	}
	
}

module.exports = self;