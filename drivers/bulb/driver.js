"use strict";

var node_hue_api = require("node-hue-api");

var lights = {};

var self = {
		
	init: function( devices_data, callback ){
		
		// get devices state
		devices_data.forEach(function(device_data){
			
			var bridge = Homey.app.getBridge( devices_data.bridge_id );
			if( bridge instanceof Error ) return Homey.error("bridge not found (yet) for bulb", devices_data.id);
			
			lights[ devices_data.id ] = bridge.lights[ devices_data.id ];
			
		})
		
		callback();
		
	},
	
	renamed: function( device, name, callback ) {
		
		console.log('RENAMED TODO')
		
		return;
		/*
		var bridge = self.getBridge( device.bridge_id );
		if( bridge instanceof Error ) return callback( new Error("bridge is unavailable") );
		
		var light = getLight( device.id );
		if( bulb instanceof Error ) return callback(bulb);
		
		bridge.api.setLightName(light.id, name)
		    .then(function(){
			    Homey.log('renamed bulb ' + light.id + ' succesfully');
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
		*/
	},
	
	deleted: function( device, callback ) {
		console.log('deleted', device, callback)
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
	
	pair: Homey.app.pair.bind({
		driver_id: 'bulb',
		filterFn: filterFn
	})
	
}

module.exports = self;

function filterFn( devices ){
	console.log('filterFn', devices)
	return devices;
}
	
/*
	Update a single bulb's state
*/
function update( light_id, callback ){
	
	var light = getLight( light_id );
	if( light instanceof Error ) return callback(light);
	
	// create a new Philips State object from the bulb's state
	var state = node_hue_api.lightState.create();
				
	if( light.state.onoff ) {
		state.on();
	} else {
		state.off();
	}
				
	if( light.state.light_temperature ) {				
		state.white(
			153 + light.state.light_temperature * 400,
			light.state.dim * 100
		)
	} else {
		state.hsl(
			Math.floor( light.state.light_hue * 360 ),
			Math.floor( light.state.light_saturation * 100 ),
			Math.floor( light.state.dim * 100 )
		);
	}
			
	// clear debounce
	if( light.updateTimeout ) clearTimeout(light.updateTimeout);
	
	// debounce
	light.updateTimeout = setTimeout(function(){
		
		// find bulb id by uniqueid			
		light.setLightState( state );
		
		// emit event to realtime listeners
		// not really clean, should actually check what changed
		// but yeah, we're building an awesome product with not so many people
		// what do you expect :-)
		[ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature' ].forEach(function(capability){
			module.exports.realtime({
				id: light.uniqueid
			}, capability, light.state[capability]);				
		});
		
		callback();
	}, 150);
	
}

// get a light
function getLight( light_id ) {
	return Homey.app.getLight( light_id );
}