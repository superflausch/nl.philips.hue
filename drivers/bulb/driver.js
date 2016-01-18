"use strict";

var node_hue_api = require("node-hue-api");

var self = {
		
	init: function( devices_data, callback ){
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
	
	pair: Homey.app.pair.bind({
		driver_id: 'bulb',
		filterFn: filterFn
	})
	
}

module.exports = self;

function filterFn( devices ){
	// TODO: filter devices by capabilities
	return devices;
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
				Homey.app.floatToCt(light.state.light_temperature),
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