"use strict";

var extend 				= require('util')._extend;
var node_hue_api 		= require("node-hue-api");

var pollInterval 		= 15000;
var typeCapabilityMap 	= {
	'on/off light'				: [ 'onoff' ],
	'dimmable light'			: [ 'onoff', 'dim' ],
	'dimmable plug-in unit'		: [ 'onoff', 'dim' ],
	'color temperature light'	: [ 'onoff', 'dim', 'light_temperature' ],
	'color light'				: [ 'onoff', 'dim', 'light_hue', 'light_saturation' ],
	'extended color light'		: [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
}
var defaultIcon 		= 'LCT001';
var iconsMap			= {
	'LCT001'	: 'LCT001',
	'LCT007'	: 'LCT001',
	'LCT002'	: 'LCT002',
	'LCT003'	: 'LCT003',
	'LST001'	: 'LST001',
	'LLC010'	: 'LLC010',
	'LLC011'	: 'LLC011',
	'LLC012'	: 'LLC011',
	'LLC006'	: 'LLC010',
	'LLC007'	: 'LLC007',
	'LLC013'	: 'LLC013',
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
var devices				= {}; // [bridge_id][light_id]

var refreshBridgeDebouncer;

var self = {

	init: function( devices_data, callback ){

		devices_data.forEach(function(device_data){
			self.setUnavailable( device_data, __("unreachable") );
			devices[ device_data.bridge_id ] = devices[ device_data.bridge_id ] || {};
			devices[ device_data.bridge_id ][ device_data.id ] = true;
		})

		refreshBridges(function(err){
			if( err ) return Homey.error(err);
			setInterval(pollBridges, pollInterval);
		});

		Homey.manager('flow').on('action.shortAlert', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			var state = node_hue_api
				.lightState
				.create()
				.shortAlert();

			light.setLightState( state, callback );

		})

		Homey.manager('flow').on('action.longAlert', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			var state = node_hue_api
				.lightState
				.create()
				.longAlert();

			light.setLightState( state, callback );

		})

		Homey.manager('flow').on('action.colorLoop', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			var state = node_hue_api
				.lightState
				.create()
				.effect('colorloop');

			light.setLightState( state, callback );

			setTimeout(function(){

				var state = node_hue_api
					.lightState
					.create()
					.effect('none');

				light.setLightState( state );

			}, args.duration*1000 || 20000);

		})

		Homey.manager('flow').on('action.startColorLoop', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			var state = node_hue_api
				.lightState
				.create()
				.effect('colorloop');

			light.setLightState( state, callback );

		})

		Homey.manager('flow').on('action.stopColorLoop', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			var state = node_hue_api
				.lightState
				.create()
				.effect('none');

			light.setLightState( state , callback);

		})
		
		Homey.manager('flow').on('action.setRandomColor', function( callback, args ){
			var light = getLight( args.device.id );
			if( light instanceof Error ) return callback( light );

			/*
			var state = node_hue_api
				.lightState
				.create()
				.effect('none');

			light.setLightState( state , callback);
			*/
			
			light.state.light_hue = Math.floor((Math.random() *65536)+1);

			update( device.id, function( result ){
				if( result instanceof Error ) return callback(result);

				self.realtime(device, 'light_hue', light_hue);
				callback( null, light.state.light_hue );
			});
			
		})

		Homey.manager('flow').on('action.allOff', function( callback, args ) {

			var state = node_hue_api
				.lightState
				.create()
				.off();

			if( args.group.id === 0 ) {
				for( var bridge_id in bridges ) {
					bridges[ bridge_id ].api.setGroupLightState( 0, state )
				}

				for( var light_id in lights ) {
					if( devices[ lights[light_id].device_data.bridge_id ] && devices[ lights[light_id].device_data.bridge_id ][ lights[light_id].device_data.id ] === true ) {
						if( typeof lights[light_id].state.onoff != 'undefined' ) {
							lights[light_id].state.onoff = false;
							self.realtime(lights[light_id].device_data, 'onoff', false);
						}
					}
				}

			} else {

				var bridge = getBridge( args.group.bridge_id );
				if( bridge instanceof Error ) return callback( bridge );

				bridge.api.setGroupLightState( args.group.id, state )

				// sync state
				args.group.lights.forEach(function(light_device_data){

					var light = getLight( light_device_data.id );
					if( light instanceof Error ) return Homey.error(light);

					light.state.onoff = false;
					self.realtime(light.device_data, 'onoff', light.state.onoff);

				})

			}



			callback( null, true );

		});

		Homey.manager('flow').on('action.allOff.group.autocomplete', function( callback, args ) {

			var result = [];

			var bridges_total 	= Object.keys(bridges).length;
			var bridges_done	= 0;

			if( bridges_total < 1 ) {
				return callback( new Error( __("no_bridges") ) );
			}

			for( var bridge_id in bridges ) {

				bridges[ bridge_id ].api.getGroups(function( err, groups ){

					if( Array.isArray(groups) ) {
						groups.forEach(function(group){

							if( group.id === '0' ) return;

							var lightsArr = [];
							group.lights.forEach(function(light_id){

								var light = getLightByBridgeAndId( bridge_id, light_id );
								if( light instanceof Error ) return;

								lightsArr.push( light.device_data );
							})

							result.push({
								bridge_id	: bridge_id,
								name		: group.name,
								id			: group.id,
								lights		: lightsArr
							})
						})
					}

					if( ++bridges_done == bridges_total ) {

						result.unshift({
							name	: __('all_lights'),
							id		: 0
						})

						callback( null, result );
					}

				})

			}

		});

		Homey.manager('flow').on('action.setScene', function( callback, args ) {

			var bridge = getBridge( args.scene.bridge_id );
			if( bridge instanceof Error ) return callback( bridge );

			bridge.api.activateScene( args.scene.id, callback );

		});

		Homey.manager('flow').on('action.setScene.scene.autocomplete', function( callback, args ) {

			var result = [];

			var bridges_total 	= Object.keys(bridges).length;
			var bridges_done	= 0;

			if( bridges_total < 1 ) {
				return callback( new Error( __("no_bridges") ) );
			}

			for( var bridge_id in bridges ) {

				bridges[ bridge_id ].api.getScenes(function( err, scenes ){

					if( Array.isArray(scenes) ) {
						scenes.forEach(function(scene){
							result.push({
								bridge_id	: bridge_id,
								name		: scene.name.split(' on ')[0],
								id			: scene.id
							})
						})
					}

					if( ++bridges_done == bridges_total ) {
						callback( null, result );
					}

				})

			}

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

	added: function( device_data, callback ) {
		devices[ device_data.bridge_id ] = devices[ device_data.bridge_id ] || {};
		devices[ device_data.bridge_id ][ device_data.id ] = true;
		refreshBridge( device_data.bridge_id );
		self.setUnavailable( device_data, __("unreachable") );
	},

	deleted: function( device_data, callback ) {
		devices[ device_data.bridge_id ] = devices[ device_data.bridge_id ] || {};
		delete devices[ device_data.bridge_id ][ device_data.id ];
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

					self.realtime(device, 'onoff', onoff);
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

					self.realtime(device, 'dim', dim);
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

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);

					self.realtime(device, 'light_hue', light_hue);
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

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);

					self.realtime(device, 'light_saturation', light_saturation);
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

				light.state.light_temperature = light_temperature;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);

					self.realtime(device, 'light_temperature', light_temperature);
					callback( null, light.state.light_temperature );
				});
			}
		},

		light_mode: {
			get: function( device, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				callback( null, light.state.light_mode );
			},
			set: function( device, light_mode, callback ) {
				var light = getLight( device.id );
				if( light instanceof Error ) return callback( light );

				light.state.light_mode = light_mode;

				update( device.id, function( result ){
					if( result instanceof Error ) return callback(result);

					self.realtime(device, 'light_mode', light_mode);
					callback( null, light.state.light_mode );
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
						.registerUser(bridge.ipaddress, 'Homey')
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
							bridge_id	: paired_bridge_id
						},
						capabilities: typeCapabilityMap[ light.type.toLowerCase() ]
					};

					if( typeof iconsMap[ light.modelid ] == 'string' ) {
						deviceObj.icon = '/icons/' + iconsMap[ light.modelid ] + '.svg';
					}

					return deviceObj;
				})
				.filter(function(deviceObj){
					return Array.isArray(deviceObj.capabilities); // filter devices with unsupported map
				})

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

	if( refreshBridgeDebouncer ) clearTimeout(refreshBridgeDebouncer);
	refreshBridgeDebouncer = setTimeout(function(){

		// get the bridge
		var bridge = getBridge( bridge_id );
		if( bridge instanceof Error ) return callback(bridge);


		// if already paired, get lights
		if( bridge.api !== false ) {
			bridge
				.api
				.lights()
				.then(function( result ) {

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
								device_data 	: {
									id				: light.uniqueid,
									bridge_id		: bridge_id
								},
								setLightState	: function( state, callback ){
									return bridge.api.setLightState( light.id, state, callback )
								},
								setLightName	: function( light_id, name ) {
									return bridge.api.setLightName( light_id, name );
								}
							};

							Homey.log('Found bulb: ' + light.name + ' (id: ' + light.id + ')');
						} else {
							var bulb = bridge.lights[ light.uniqueid ];
						}

						var values = {
							onoff 				: light.state.on,
							dim		 			: (light.state.bri+1) / 255,
							light_hue 			: light.state.hue / 65535,
							light_saturation	: (light.state.sat+1) / 255,
							light_temperature 	: ctToFloat( light.state.ct ),
							light_mode			: ( light.state.colormode == 'ct' ) ? 'temperature' : 'color'
						}

						if( devices[ bulb.device_data.bridge_id ] && devices[ bulb.device_data.bridge_id ][ bulb.device_data.id ] === true ) {

						    // set capabilities if changed
						    var capabilities = typeCapabilityMap[ light.type.toLowerCase() ];
						    if( Array.isArray(capabilities) ) {
							    capabilities.forEach(function(capability){
								    if( bulb.state[ capability ] != values[ capability ] ) {
									    bulb.state[ capability ] =  values[ capability ];
									    self.realtime( bulb.device_data, capability, bulb.state[ capability ] );
								    }
							    })
						    }

							// set available or unavailable
							// Living Color lights's reachable flag is flaky, though
							if( light.modelid === 'LLC006' || light.modelid === 'LLC007' ) {
								self.setAvailable( bulb.device_data );
							} else {
								if( light.state.reachable === false ) {
									self.setUnavailable( bulb.device_data, __("unreachable") );
								} else if( light.state.reachable === true ) {
									self.setAvailable( bulb.device_data );
								}
							}

						}

					});

					callback();

				})
				.fail(function( err ){
					Homey.error(err);
					callback( err );
				})
				.done();

		} else {
			if( typeof callback == 'function' ) {
				callback( new Error("Bridge not paired yet") );
			}
		}

	}, 300);

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

	// update: onoff
	if( typeof light.state.onoff != 'undefined' ) {
		if( light.state.onoff === true ) {
			state = state.on();
		} else {
			state = state.off();
		}
	}

	// update: dim
	if( typeof light.state.dim != 'undefined' )						state.bri( Math.floor( light.state.dim * 255 ) )

	// update: light_temperature && light_hue && light_saturation
	if( light.state.light_mode == 'temperature' || ( typeof light.state.light_hue === 'undefined' && typeof light.state.light_temperature === 'number' ) ) {
		if( typeof light.state.light_temperature != 'undefined' )	state.ct( floatToCt( light.state.light_temperature ) );
	} else {
		if( typeof light.state.light_hue != 'undefined' ) 			state.hue( Math.floor( light.state.light_hue * 65535 ) );
		if( typeof light.state.light_saturation != 'undefined' ) 	state.sat( Math.floor( light.state.light_saturation * 255 ) );
	}

	// clear debounce
	if( light.updateTimeout ) clearTimeout(light.updateTimeout);

	// debounce
	light.updateTimeout = setTimeout(function(){
		light.setLightState( state, callback );
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
	Get a light by uniqueid
*/
function getLight( light_id ) {
	return lights[ light_id ] || new Error("invalid light_id")
}

/*
	Get a light by bridge_id and light_id
*/
function getLightByBridgeAndId( bridge_id, light_id ) {
	var bridge = getBridge( bridge_id );
	if( bridge instanceof Error ) return bridge;

	for( var light_uuid in bridge.lights ) {
		if( bridge.lights[ light_uuid ].id === light_id ) {
			return getLight( light_uuid );
		}
	}
}

// color-temperature to float & vice-versa
function ctToFloat( ct ) {
	return (ct-154)/(500-154)
}

function floatToCt( f ) {
	return (f*(500-154))+154;
}