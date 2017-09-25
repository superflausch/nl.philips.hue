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
			.catch( this.error );
	}
	
	_onFlowActionSetScene( args ) {
		
	}
	
	_onFlowActionGroupOn( args ) {
		
	}
	
	_onFlowActionGroupOff( args ) {
		
	}
	
	_onSceneAutocomplete( query ) {
		
	}
	
	_onGroupAutocomplete( query ) {
		
	}
	
}

module.exports = App;