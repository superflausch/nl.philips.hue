"use strict";

var extend 				= require('util')._extend;
var node_hue_api 		= require("node-hue-api");

var pollInterval 		= 15000;
var typeCapabilityMap 	= {
	'On/Off light'				: [ 'onoff' ],
	'Dimmable light'			: [ 'onoff', 'dim' ],
	'Color Temperature Light'	: [ 'onoff', 'light_temperature' ],
	'Color light'				: [ 'onoff', 'dim', 'light_hue', 'light_saturation' ],
	'Extended color light'		: [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature' /*,light_mode*/ ],
}
var defaultIcon 		= 'LCT001';
var iconsMap			= {
	'LCT001'	: 'LCT001',
	'LCT007'	: 'LCT001',
	'LCT002'	: 'LCT003', // TODO
	'LCT003'	: 'LCT003',
	'LST001'	: 'LST001',
	'LLC010'	: defaultIcon, // TODO
	'LLC011'	: defaultIcon, // TODO
	'LLC012'	: defaultIcon, // TODO
	'LLC006'	: defaultIcon, // TODO
	'LLC007'	: defaultIcon, // TODO
	'LLC013'	: defaultIcon, // TODO
	'LWB004'	: 'LCT001',
	'LWB006'	: 'LCT001',
	'LWB007'	: 'LCT001',
	'LLM001'	: defaultIcon,
	'LLM010'	: defaultIcon,
	'LLM011'	: defaultIcon,
	'LLM012'	: defaultIcon,
	'LLC020'	: 'LLC020',
	'LST002'	: 'LST001'

}

var bridges 			= {};
var lights 				= {};

var self = {

	init: function( devices_data, callback ){

		refreshBridges(function(err){
			if( err ) return Homey.error(err);
			setInterval(pollBridges, pollInterval);
		});

		callback();
	},

	renamed: function( device, name, callback ) {

		callback = callback || function(){}

		var light = getLight( device.id );
		if( light instanceof Error ) return callback(light);

		light.setLightName( light.id, name )
		    .then(function(){
			    Homey.log('renamed light ' + device.id + ' succesfully');
		    	callback( null )
		    })
		    .fail(function( err ){
			    Homey.error(err);
		    	callback( err )
		    })
		    .done();
	},

	deleted: function( device, callback ) {
		console.log('deleted', device)
	},

	capabilities: {

		onoff: {
			get: function( device, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.onoff );
			},
			set: function( device, onoff, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.onoff = onoff;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, light.state.onoff );
				});

			}
		},

		dim: {
			get: function( device, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.dim );
			},
			set: function( device, dim, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.dim = dim;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, light.state.dim );
				});
			}
		},

		light_hue: {
			get: function( device, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.light_hue );
			},
			set: function( device, light_hue, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.light_hue = light_hue;
				light.state.light_temperature = false;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, light.state.light_hue );
				});
			}
		},

		light_saturation: {
			get: function( device, callback ){
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.light_saturation );
			},
			set: function( device, light_saturation, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.light_saturation = light_saturation;
				light.state.light_temperature = false;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, light.state.light_saturation );
				});

			}
		},

		light_temperature: {
			get: function( device, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.light_temperature );
			},
			set: function( device, light_temperature, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.light_hue = false;
				light.state.light_temperature = light_temperature;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);
					callback( null, light.state.light_temperature );
				});
			}
		}

	},

	pair: function( socket ) {

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
							Homey.manager('settings').set('bridge_token_' + paired_bridge_id, access_token );

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

					var deviceObj = {
						name	: light.name,
						data 	: {
							id			: light.uniqueid,
							bridge_id	: bridge.id
						},
						capabilities: typeCapabilityMap[ light.type ]
					};

					if( typeof iconsMap[ light.modelid ] == 'string' ) {
						deviceObj.icon = '/icons/' + iconsMap[ light.modelid ] + '.svg';
					}

					return deviceObj;
				});

			callback( null, devices );

		});

		socket.on('disconnect', function(){
		    for( var retryTimeout in retryTimeouts ) {
			    clearTimeout(retryTimeouts[ retryTimeout ]);
		    }
		})

	}

}

module.exports = self;

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

					var firstTime = ( typeof bridge.lights[ light.uniqueid ] == 'undefined' );
					if( firstTime ) {
						var bulb = bridge.lights[ light.uniqueid ] = lights[ light.uniqueid ] = {
							uniqueid		: light.uniqueid,
							id				: light.id,
							type			: light.type,
							name			: light.name,
							modelid			: light.modelid,
							state			: {},
							hardwareState	: {},
							setLightState	: function( state, callback ){
								bulb.hardwareState = extend(bulb.hardwareState, bulb.state);
								return bridge.api.setLightState( light.id, state, callback)
							},
							setLightName	: function( light_id, name ) {
								return bridge.api.setLightName( light_id, name );
							}
						};

						Homey.log('Found bulb: ' + light.name + ' (id: ' + light.id + ')');
					} else {
						var bulb = bridge.lights[ light.uniqueid ];
					}

					// get current light status
					bridge
						.api
						.lightStatus(light.id)
					    .then(function(status){

							var device_data = {
								id			: bulb.uniqueid,
								bridge_id	: bridge_id
							}

							var values = {
								onoff 				: status.state.on,
								dim		 			: (status.state.bri+1) / 255,
								light_hue 			: status.state.hue / 65535,
								light_saturation	: (status.state.sat+1) / 255,
								light_temperature 	: ctToFloat( status.state.ct )
							}

							if( status.state.colormode == 'hs' ) {
								values.light_mode = 'color';
							} else if( status.state.colormode == 'ct' ) {
								values.light_mode = 'temperature';
							}

						    // set capabilities if changed
						    typeCapabilityMap[ light.type ].forEach(function(capability){
							    if( bulb.state[ capability ] != values[ capability ] ) {
								    bulb.state[ capability ] =  values[ capability ];
								    self.realtime( device_data, capability, bulb.state[ capability ] );
							    }
						    })

							bulb.hardwareState = extend(bulb.hardwareState, bulb.state);

							// set available or unavailable
							if( status.state.reachable ) {
								self.setAvailable( device_data );
							} else {
								self.setUnavailable( device_data, __("unreachable") );
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
	Update a single bulb's state
*/
function update( light_id, callback ){

	callback = callback || function(){}

	var light = getLight( light_id );
	if( light instanceof Error ) return callback(light);

	// create a new Philips State object from the bulb's state
	var state = node_hue_api.lightState.create();

	var changedStates = [];

	// update: onoff
	if( light.state.onoff != light.hardwareState.onoff ) {
		changedStates.push('onoff')
		if( light.state.onoff === true ) {
			state.on();
		} else {
			state.off();
		}
	}

	// update: light_temperature && light_hue && light_saturation
	if(
		light.state.dim					!= light.hardwareState.dim					||
		light.state.light_temperature 	!= light.hardwareState.light_temperature 	||
		light.state.light_hue 			!= light.hardwareState.light_hue 			||
		light.state.light_saturation 	!= light.hardwareState.light_saturation
	) {

		if( light.state.dim					!= light.hardwareState.dim ) 				changedStates.push('dim');
		if( light.state.light_temperature 	!= light.hardwareState.light_temperature ) 	changedStates.push('light_temperature');
		if( light.state.light_hue 			!= light.hardwareState.light_hue ) 			changedStates.push('light_hue');
		if( light.state.light_saturation 	!= light.hardwareState.light_saturation ) 	changedStates.push('light_saturation');

		if( typeof light.state.light_temperature == 'number' ) {
			state.white(
				floatToCt(light.state.light_temperature),
				light.state.dim * 100
			)
		} else {

			state.hsl(
				Math.floor( light.state.light_hue * 360 ),
				Math.floor( light.state.light_saturation * 100 ),
				Math.floor( light.state.dim * 100 )
			);
		}
	}

	if( changedStates.length < 1 ) return callback();

	// clear debounce
	if( light.updateTimeout ) clearTimeout(light.updateTimeout);

	// debounce
	light.updateTimeout = setTimeout(function(){

		// find bulb id by uniqueid
		light.setLightState( state, function(err, result){
			// TODO
			//if( err ) return self.setUnavailable(  );
			//self.setAvailable(  );
		});

		// emit event to realtime listeners
		changedStates.forEach(function(capability){
			self.realtime({
				id: light.uniqueid
			}, capability, light.state[capability]);
		});

		callback();
	}, 150);

}

/*
	Poll bridges for remote changes
*/
function pollBridges(){
	for( var bridge_id in bridges ) {
		refreshBridge( bridge_id );
	}
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

// color-temperature to float & vice-versa
function ctToFloat( ct ) {
	return (ct-154)/(500-154)
}

function floatToCt( f ) {
	return (f*(500-154))+154;
}