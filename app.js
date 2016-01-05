"use strict";

var node_hue_api = require("node-hue-api");
var bridges = {};
var lights = {};

var self 		= module.exports;
self.init 		= init;
self.pair 		= pair;
self.getBridge 	= getBridge;
self.getLight 	= getLight;

function init(){
	refreshBridges();
}

/*
	Get a bridge by ID
*/
function getBridge( bridge_id ) {
	return bridges[ bridge_id ] || new Error("invalid bridge id");
}

/*
	Get a light
*/
function getLight( light_id ) {
	return lights[ light_id ] || new Error("invalid light_id")
}

/*
	Search for bridges on the network, and get their state
*/
function refreshBridges( callback ) {
	
	callback = callback || function(){}
		
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
	
				addBridgeAndRefresh( bridge.id, bridge.ipaddress, function(){
					num_refreshed_bridges++;
					if( num_refreshed_bridges == found_bridges.length ) {
						if( typeof callback == 'function' ) {
							callback();
						}
					}					
				})
				
				Homey.log('Found bridge! ID: ' + bridge.id + ', IP: ' + bridge.ipaddress);
				
			});
			
		})
		.fail(function( err ){
			if( typeof callback == 'function' ) {
				callback( err );
			}				
		})
		.done();
	
}

function addBridgeAndRefresh( bridge_id, bridge_ipaddress, callback ){
	
	callback = callback || function(){}
	
	// add this bridge to the local bridges object
	bridges[ bridge_id ] = {
		ipaddress	: bridge_ipaddress,
		api			: false,
		lights		: {}
	};
	
	// initialize the API
	var token = Homey.manager('settings').get('bridge_token_' + bridge_id );
	if( token ) {
		bridges[ bridge_id ].api = new node_hue_api.HueApi(bridge_ipaddress, token);
	}
				
	refreshBridge( bridge_id, callback );
}

/*
	Get a bridge and refresh it's state
*/
function refreshBridge( bridge_id, callback ) {
	
	callback = callback || function(){}
						
	// get the bridge
	var bridge = getBridge( bridge_id );
	if( bridge instanceof Error ) return callback(bridge);
			
	// if already paired, get lights
	if( bridge.api !== false ) {
		bridge
			.api
			.lights()
			.then(function( result ) {											
				var num_lights_paired = 0;
				result.lights.forEach(function(light){
																							
					var bulb = bridge.lights[ light.uniqueid ] = lights[ light.uniqueid ] = {
						uniqueid: light.uniqueid,
						id		: light.id,
						name	: light.name,
						modelid	: light.modelid,
						state	: {
							on					: false,
							dim					: 1.0,
							light_hue			: false,
							light_saturation	: 1.0,
							light_temperature	: 0.5
						},
						setLightState: function( state ){
							return bridge.api.setLightState( light.id, state )
						},
						setLightName: function( light_id, name ) {
							return bridge.api.setLightName( light_id, name );
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
				Homey.error(err);
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
	
}

/*
	Find lights
*/
function pair( socket ) {
	
	var driver_id = this.driver_id;
	var filterFn = this.filterFn;
	var paired_bridge_id;
	var retryTimeouts = {};
	
	socket.on('press_button', function( data, callback ){
		
		refreshBridges(function( err ){
			if( err ) Homey.error(err.stack);
						
			Homey.log('Hue bridge pairing has started', bridges);
			
			for( var bridge_id in bridges ) {
				tryRegisterUser( bridge_id );			
			}
			
			function tryRegisterUser( bridge_id ){	
				var bridge = bridges[bridge_id];
								
				new node_hue_api.HueApi()
					.registerUser(bridge.ipaddress, null, 'Homey')
				    .then(function( access_token ){
					    Homey.log('Pair button pressed', access_token);
					    	
						paired_bridge_id = bridge_id;
					    
					    // clear timeouts
					    for( var retryTimeout in retryTimeouts ) {
						    clearTimeout(retryTimeouts[ retryTimeout ]);
					    }
					    				    
					    // save the token
						Homey.manager('settings').set('bridge_token_' + bridge.id, access_token );
											
						// refresh this bridge
						addBridgeAndRefresh( bridge_id, bridge.ipaddress, function(){
							socket.emit('button_pressed');							
						});
				    })
				    .fail(function( error ){
					    retryTimeouts[ bridge_id ] = setTimeout(function(){
						    if( typeof pairing_bridge_id == 'undefined' ) {
							    tryRegisterUser( bridge_id );
						    }
					    }, 250);
				    })
				    .done();
				
			}
		
		});
		
		
	});
	
	socket.on('list_devices', function( data, callback ) {
		
		var bridge = bridges[ paired_bridge_id ];
		
		var devices = Object
			.keys(bridge.lights)
			.map(function(light_id){
				var light = bridge.lights[light_id];
				return {
					data: {
						id			: light.uniqueid,
						bridge_id	: bridge.id
					},
					icon: '/icons/' + light.modelid + '.svg',
					name: light.name
				};
			});
				
		callback( null, devices );
		
	});
	
	socket.on('disconnect', function(){				    
	    for( var retryTimeout in retryTimeouts ) {
		    clearTimeout(retryTimeouts[ retryTimeout ]);
	    }
	})
	
}