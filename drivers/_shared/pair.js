'use strict';

module.exports = function( socket, eventListeners ) {

	let state = {
		connected	: true,
		bridge		: undefined
	};

	socket
		.on('select_bridge', ( data, callback ) => {

			let result = [];
			let bridges = Homey.app.getBridges();
			for( let bridgeId in bridges ) {
				state.bridge = bridges[ bridgeId ];

				result.push({
					id		: bridgeId,
					name	: state.bridge.name || state.bridge.address,
					icon	: state.bridge.icon
				})
			}

			callback( null, result );

		})
		.on('press_button', ( data, callback ) => {

			state.bridge = Homey.app.getBridge( data.bridgeId );
			if( state.bridge instanceof Error ) return callback( bridge );

			if( state.bridge.isAuthenticated() ) {
				return callback( null, true );
			} else {
				register();
				return callback( null, false );
			}

			function register() {
				setTimeout(() => {
					state.bridge.register(( err, result ) => {
						if( err && err.type === 101 && state.connected ) return register();
						return socket.emit('authenticated');
					})
				}, 1000);
			}

		})
		.on('disconnect', () => {
			state.connected = false;
		})

	for( let eventListenerId in eventListeners ) {
		socket.on( eventListenerId, ( data, callback ) => {
			eventListeners[ eventListenerId ]( state, data, callback );
		});
	}
}