"use strict";

var node_hue_api = require("node-hue-api");

var bridges = {};
var pairing_bridge_id;

var self = {
		
	init: function( devices, callback ){
		self.refresh(callback);
	},
	
	refresh: function( callback ) {
		
		// find the bridge
		node_hue_api
			.nupnpSearch() // TODO: fallback to upnpSearch. Didn't work on my network tho
			.then(function(found_bridges) {
								
				if( found_bridges.length < 1 ) {
					Homey.error('No bridges were found');
					return callback( new Error("no bridges found") );
				}
				
				var num_refreshed_bridges = 0;		
				found_bridges.forEach(function(bridge){
					
					Homey.log('Found bridge! ID: ' + bridge.id + ', IP: ' + bridge.ipaddress);
		
					// add this bridge to the local bridges object
					bridges[ bridge.id ] = {
						ip		: bridge.ipaddress,
						api		: false,
						bulbs	: {}
					};
					
					// get the token, or create the settings object
					if( typeof Homey.settings.bridges == 'undefined' ) {
						Homey.settings.bridges = {};
					}
					
					if( typeof Homey.settings.bridges[ bridge.id ] == 'undefined' ) {
						Homey.settings.bridges[ bridge.id ] = {
							token: false
						};
					}
					
					var token = Homey.settings.bridges[ bridge.id ].token;
					
					if( token !== false ) {
						bridges[ bridge.id ].api = new node_hue_api.HueApi(bridge.ipaddress, token);
					}
					
					self.refreshBridge( bridge.id, function(){
						num_refreshed_bridges++;
						if( num_refreshed_bridges == found_bridges.length ) {
							if( typeof callback == 'function' ) {
								callback();
							}
						}
					});
					
				});
				
			})
			.fail(function( err ){
				if( typeof callback == 'function' ) {
					callback( err );
				}				
			})
			.done();
		
	},
	
	refreshBridge: function( bridge_id, callback ) {
						
		// get the bridge
		var bridge = self.getBridge( bridge_id );
		if( bridge instanceof Error ) return Homey.error(bridge);
				
		// if already paired, get bulbs
		if( bridge.api !== false ) {
			bridge
				.api
				.lights()
				.then(function( result ) {
												
					var num_lights_paired = 0;
					result.lights.forEach(function(light){
																								
						var bulb = bridge.bulbs[ light.uniqueid ] = {
							id		: light.id,
							name	: light.name,
							modelid	: light.modelid,
							state	: {
								on					: false,
								dim					: 1.0,
								light_hue			: false,
								light_saturation	: 1.0,
								light_temperature	: 0.5
							}
						};
						
						// get current light status
						bridge
							.api
							.lightStatus(light.id)
						    .then(function(status){				
								bulb.state.onoff 			= status.state.on;
								bulb.state.dim		 		= (status.state.bri+1) / 255;
								
								if( status.state.colormode == 'hs' ) {
									bulb.state.light_hue 			= status.state.light_hue / 65535;										
									bulb.state.light_temperature 	= false;
								} else if( status.state.colormode == 'ct' ) {
									bulb.state.light_temperature 	= (status.state.ct-154)/(500-154);
									bulb.state.light_hue 			= false;
								}
								
								// check if we're done
								num_lights_paired++;
								if( num_lights_paired == result.lights.length ) {																
									if( typeof callback == 'function' ) {
										callback();
									}
								}
								
						    })
						    .fail(function(){
								num_lights_paired++;
								if( num_lights_paired == result.lights.length ) {																
									if( typeof callback == 'function' ) {
										callback();
									}
								}
							    
						    })
						    .done();
						
						Homey.log('Found bulb: ' + light.name + ' (id: ' + light.id + ')');
						
					});
					
				})
				.fail(function( err ){
					if( typeof callback == 'function' ) {
						callback( err );
					}				
				})
				.done();
			
		} else {			
			if( typeof callback == 'function' ) {
				callback( new Error("Bridge not paired yet") );
			}
		}
		
	},
	
	getBridge: function( bridge_id ) {
		if( typeof bridges[bridge_id] == 'undefined' ) return new Error("bridge is not connected (yet)");
		return bridges[bridge_id];
	},
	
	getBulb: function( bridge_id, bulb_id ) {
		var bridge = self.getBridge( bridge_id );
		if( bridge instanceof Error ) return bridge;
		
		if( typeof bridge.bulbs[bulb_id] == 'undefined' ) return new Error("bulb is not connected (yet)");
		return bridge.bulbs[bulb_id];
	},
	
	/*
		Update a single bulb's state
	*/
	update: function( bridge_id, bulb_id, callback ){
				
		// get the bridge
		var bridge = self.getBridge( bridge_id );
		if( bridge instanceof Error ) return callback(bridge);

		if( bridge.api === false ) return callback( new Error("Bridge token expired") );
		
		// get the bulb
		var bulb = self.getBulb( bridge_id, bulb_id );
		if( bulb instanceof Error ) return callback(bulb);
		
		// create a new Philips State object from the bulb's state
		var state = node_hue_api.lightState.create();
					
		if( bulb.state.onoff ) {
			state.on();
		} else {
			state.off();
		}
					
		if( bulb.state.light_temperature ) {				
			state.white(
				153 + bulb.state.light_temperature * 400,
				bulb.state.dim * 100
			)
		} else {
			state.hsl(
				Math.floor( bulb.state.light_hue * 360 ),
				Math.floor( bulb.state.light_saturation * 100 ),
				Math.floor( bulb.state.dim * 100 )
			);
		}
				
		// clear debounce
		if( typeof bulb.timeout != 'undefined' ) {
			clearTimeout(bulb.timeout);
		}
		
		// debounce
		bulb.timeout = setTimeout(function(){
			// find bulb id by uniqueid			
			bridge.api.setLightState( bulb.id, state );
			
			// emit event to realtime listeners
			// not really clean, should actually check what changed
			// but yeah, we're building an awesome product with not so many people
			// what do you expect :-)
			[ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature' ].forEach(function(capability){
				module.exports.realtime({
					id: generateDeviceID( bridge_id, bulb_id )
				}, capability, bulb.state[capability]);				
			});
			
			callback();
		}, 150);
		
	},
	
	renamed: function( device, name, callback ) {
					
		var bridge = self.getBridge( device.bridge_id );
		if( bridge instanceof Error ) return callback( new Error("bridge is unavailable") );
		
		var bulb = self.getBulb( device.bridge_id, device.bulb_id );
		if( bulb instanceof Error ) return callback(bulb);
		
		bridge.api.setLightName(bulb.id, name)
		    .then(function(){
			    Homey.log('renamed bulb ' + bulb.id + ' succesfully');
			    if( typeof callback == 'function' ) {
			    	callback( null )
			    }
		    })
		    .fail(function( err ){
			    Homey.error(err);
			    if( typeof callback == 'function' ) {
			    	callback( err )
			    }
		    })
		    .done();
	},
	
	deleted: function( device, callback ) {
		console.log('deleted', device, callback)
	},
	
	capabilities: {
		
		onoff: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( null, bulb.state.onoff );
			},
			set: function( device, onoff, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
								
				bulb.state.onoff = onoff;
				
				self.update( device.bridge_id, device.bulb_id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, bulb.state.onoff );					
				});
								
			}
		},
		
		light_hue: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
							
				callback( null, bulb.state.light_hue );
			},
			set: function( device, light_hue, callback ) {
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
							
				bulb.state.light_hue = light_hue;
				bulb.state.light_temperature = false;
				
				self.update( device.bridge_id, device.bulb_id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, bulb.state.light_hue );					
				});
			}
		},
		
		light_saturation: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
							
				callback( null, bulb.state.light_saturation );
			},
			set: function( device, light_saturation, callback ) {			
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
							
				bulb.state.light_saturation = light_saturation;
				bulb.state.light_temperature = false;
				
				self.update( device.bridge_id, device.bulb_id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, bulb.state.light_saturation );					
				});
				
			}
		},
		
		dim: {
			get: function( device, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( null, bulb.state.dim );
			},
			set: function( device, dim, callback ){
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
				
				bulb.state.dim = dim;
				
				self.update( device.bridge_id, device.bulb_id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, bulb.state.dim );					
				});
			}
		},
		
		light_temperature: {
			get: function( device, callback ) {
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
				
				callback( null, bulb.state.light_temperature );
			},
			set: function( device, light_temperature, callback ) {
				var bulb = self.getBulb( device.bridge_id, device.bulb_id );
				if( bulb instanceof Error ) return callback( bulb );
	
				bulb.state.light_hue = false;
				bulb.state.light_temperature = light_temperature;
				
				self.update( device.bridge_id, device.bulb_id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, bulb.state.light_temperature );					
				});
			}
		}
	
	},
	
	pair: {
		press_button: function( callback, emit, data ){
						
			Homey.log('Hue bridge pairing has started');
			
			for( var bridge_id in bridges ) {
				tryRegisterUser( bridge_id );			
			}
			
			function tryRegisterUser( bridge_id ){
					
				var bridge = bridges[bridge_id];
								
				new node_hue_api.HueApi()
					.registerUser(bridge.ip, null, 'Homey')
				    .then(function( access_token ){
					    Homey.log('Pair button pressed', access_token);
					    
					    // save the token
					    Homey.settings.bridges[ bridge_id ].token = access_token;
					    
					    // make sure we're pairing only 1 bridge
						pairing_bridge_id = bridge_id;
						
						// create the api
						bridge.api = new node_hue_api.HueApi(bridge.ip, access_token);
						
						// refresh this bridge
						self.refreshBridge( bridge_id, function(){
						    emit('button_pressed');							
						});
				    })
				    .fail(function( error ){
					    setTimeout(function(){
						    if( typeof pairing_bridge_id == 'undefined' ) {
							    tryRegisterUser( bridge_id );
						    }
					    }, 250);
				    })
				    .done();
				
			}
			
			
		},
		list_devices: function( callback, emit, data ) {
			
			var bridge = self.getBridge( pairing_bridge_id );
			if( bridge instanceof Error ) return callback( new Error("bridge suddenly unavailable") );
						
			var devices = Object
				.keys(bridge.bulbs)
				.map(function(bulb_id){
					var bulb = bridge.bulbs[bulb_id];
					return {
						data: {
							id			: generateDeviceID( pairing_bridge_id, bulb_id ),
							bulb_id		: bulb_id,
							bridge_id	: pairing_bridge_id
						},
						icon: '/icons/' + bulb.modelid + '.svg',
						name: bulb.name
					};
				});
			
			callback( devices );

			pairing_bridge_id = undefined;
			
		},
		pair: function( callback, emit, data ) {
			// done pairing
		}
	}
	
}

module.exports = self;

 // create a virtual device id, to prevent duplicate devices
function generateDeviceID( bulb_id, bridge_id ) {
	return new Buffer( bulb_id + bridge_id).toString('base64');
}