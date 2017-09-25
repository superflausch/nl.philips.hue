'use strict';

const Homey = require('homey');
const Log = require('homey-log').Log;
const huejay = require('huejay');

const Discovery = require('./lib/Discovery.js');

class App extends Homey.App {
	
	onInit() {
		this.log(`${Homey.app.manifest.id} is running...`);
		
		this._onBridge = this._onBridge.bind(this);
		this._onFlowActionSetScene = this._onFlowActionSetScene.bind(this);
		this._onFlowActionGroupOn = this._onFlowActionGroupOn.bind(this);
		this._onFlowActionGroupOff = this._onFlowActionGroupOff.bind(this);
		this._onSceneAutocomplete = this._onSceneAutocomplete.bind(this);
		this._onGroupAutocomplete = this._onGroupAutocomplete.bind(this);
		
		/*
			Initialize Discovery
		*/
		this._discovery = new Discovery();
		this._discovery
			.on('__log', this.log.bind( this, '[Discovery]'))
			.on('__error', this.error.bind( this, '[Discovery]'))
			.on('bridge', this._onBridge)
			.start();
			
		/*
			Initialize Flow
		*/			
		new Homey.FlowCardAction('setScene')
			.register()
			.registerRunListener( this._onFlowActionSetScene )
			.getArgument('scene')
			.registerAutocompleteListener( this._onSceneAutocomplete );
			
		new Homey.FlowCardAction('groupOn')
			.register()
			.registerRunListener( this._onFlowActionGroupOn )
			.getArgument('group')
			.registerAutocompleteListener( this._onGroupAutocomplete );
			
		new Homey.FlowCardAction('groupOff')
			.register()
			.registerRunListener( this._onFlowActionGroupOff )
			.getArgument('group')
			.registerAutocompleteListener( this._onGroupAutocomplete );
	}
	
	getBridges() {
		return this._discovery.getBridges();
	}
	
	getBridge( bridgeId ) {
		return this._discovery.getBridge( bridgeId );
	}
	
	_onBridge( bridge ) {
		bridge
			.on('__log', this.log.bind( this, `[Bridge][${bridge.id}]`))
			.on('__error', this.error.bind( this, `[Bridge][${bridge.id}]`))
			.on('available', () => {
				this.emit(`bridge_${bridge.id}`, bridge);
			})
			.init()
			.catch(err => {
				if( err && err.message === 'no_token' )
					return this.error(`Bridge ${bridge.id} is not yet authorized`);
					
				this.error(err);
			});
	}
	
	_onFlowActionSetScene( args ) {
		let bridge = this.getBridge( args.scene.bridge_id );
		if( bridge instanceof Error ) return Promise.reject( bridge );

		return bridge.setScene( args.scene.id );		
	}
	
	_onFlowActionGroupOn( args ) {
		this._onFlowActionGroup( args, true );		
	}
	
	_onFlowActionGroupOff( args ) {
		this._onFlowActionGroup( args, false );
	}
	
	_onFlowActionGroup( args, onoff ) {
		let bridge = this.getBridge( args.group.bridge_id );
		if( bridge instanceof Error ) return Promise.reject( bridge );

		return bridge.getGroup( args.group.id )
			.then(group => {
				group.on = onoff;
				return bridge.saveGroup( group )
			})
			.then(group => {
				let lights = bridge.getLights();
				let driver = Homey.ManagerDrivers.getDriver('bulb');

				for( let lightId in lights ) {
					let light = lights[lightId];
					
					if( group.lightIds.indexOf( light.id.toString() ) > -1 ) {
						let device = driver.getDevice( this.getDeviceData( bridge, light ));
						if( device instanceof Error ) continue;
						
						device.setCapabilityValue('onoff', onoff);
					}
				}
			});
	}
	
	_onSceneAutocomplete( query ) {
		
		const calls = [];
		const bridges = this.getBridges();

		if( Object.keys(bridges).length < 1 )
			return Promise.reject( new Error( __("no_bridges") ) );


		for( let bridgeId in bridges ) {
			let bridge = bridges[ bridgeId ];

			let call = bridge.getScenes()
				.then(scenes => ({ bridge, scenes }))
				.catch(err => {
					return err;
				})
			calls.push( call );
		}

		return Promise.all( calls )
			.then( results => {

				let resultArray = [];
	
				results.forEach((result) => {
					if( result instanceof Error ) return;
	
					let bridge = result.bridge;
					result.scenes.forEach((scene) => {
						resultArray.push({
							bridge_id			: bridge.id,
							name				: scene.name.split(' on ')[0],
							id					: scene.id,
							description			: bridge.name,
							description_icon	: bridge.icon
						})
					});
				});
	
				resultArray = resultArray.filter(( resultArrayItem ) => {
					return resultArrayItem.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
				});
				
				return resultArray;
			});
		
	}
	
	_onGroupAutocomplete( query ) {
		
		const calls = [];
		const bridges = this.getBridges();

		if( Object.keys(bridges).length < 1 )
			return Promise.reject( new Error( __("no_bridges") ) );


		for( let bridgeId in bridges ) {
			let bridge = bridges[ bridgeId ];

			let call = bridge.getGroups()
				.then(groups => ({ bridge, groups }))
				.catch(err => {
					return err;
				})
			calls.push( call );
		}

		return Promise.all( calls )
			.then( results => {
		
				let resultArray = [];
						
				results.forEach(result => {
					if( result instanceof Error ) return;
		
					let bridge = result.bridge;
		
					resultArray.push({
						bridge_id			: bridge.id,
						name				: Homey.__('all_lights'),
						id					: 0,
						description			: bridge.name,
						description_icon	: bridge.icon
					});
		
					result.groups.forEach((group) => {
						resultArray.push({
							bridge_id			: bridge.id,
							name				: group.name,
							id					: group.id,
							description			: bridge.name,
							description_icon	: bridge.icon
						})
					});
		
				});
		
				resultArray = resultArray.filter(( resultArrayItem ) => {
					return resultArrayItem.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
				});
				
				return resultArray;
			});
		
	}

	getDeviceData( bridge, device ) {
		return {
			id			: device.uniqueId,
			bridge_id	: bridge.id
		}
	}
	
}

module.exports = App;