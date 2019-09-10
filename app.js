'use strict';

const Homey = require('homey');
const HueDiscovery = require('./lib/HueDiscovery.js');
const HueError = require('./lib/HueError.js');

module.exports = class HueApp extends Homey.App {
  
  onInit() {
    this.log(`${Homey.app.manifest.id} is running...`);
    
    this.bridges = {};
    
    this.onDiscoveryBridge = this.onDiscoveryBridge.bind(this);
    this.onFlowActionSetScene = this.onFlowActionSetScene.bind(this);
    this.onFlowActionGroupOn = this.onFlowActionGroupOn.bind(this);
    this.onFlowActionGroupOff = this.onFlowActionGroupOff.bind(this);
    this.onFlowSceneAutocomplete = this.onFlowSceneAutocomplete.bind(this);
    this.onFlowGroupAutocomplete = this.onFlowGroupAutocomplete.bind(this);
    this.onFlowActionGroupSetBrightness = this.onFlowActionGroupSetBrightness.bind(this);
    
    this.onInitDiscovery();
    this.onInitFlow();  
  }
  
  onInitDiscovery() {
    this.discovery = new HueDiscovery();
    this.discovery
      .on('__log', (...args) => this.log('[Discovery]', ...args))
      .on('__error', (...args) => this.error('[Discovery]', ...args))
      .on('bridge', this.onDiscoveryBridge)
      .start();    
  }
  
  onInitFlow() {
    new Homey.FlowCardAction('setScene')
      .register()
      .registerRunListener( this.onFlowActionSetScene )
      .getArgument('scene')
      .registerAutocompleteListener( this.onFlowSceneAutocomplete );
      
    new Homey.FlowCardAction('groupOn')
      .register()
      .registerRunListener( this.onFlowActionGroupOn )
      .getArgument('group')
      .registerAutocompleteListener( this.onFlowGroupAutocomplete );
      
    new Homey.FlowCardAction('groupOff')
      .register()
      .registerRunListener( this.onFlowActionGroupOff )
      .getArgument('group')
      .registerAutocompleteListener( this.onFlowGroupAutocomplete );  
      
    new Homey.FlowCardAction('groupSetBrightness')
      .register()
      .registerRunListener( this.onFlowActionGroupSetBrightness )
      .getArgument('group')
      .registerAutocompleteListener( this.onFlowGroupAutocomplete );      
  }
  
  async getBridge(id, wait = true) {
    const bridge = this.bridges[id];
    if(bridge) return bridge;
    
    if(!wait)
      throw new HueError('bridge_unavailable');
    
    return new Promise(resolve => {
      this.once(`bridge_${id}`, resolve);
    });
  }
  
  onDiscoveryBridge( bridge ) {
    this.log(`Discovered bridge: ${bridge.id}@${bridge.address}`);
    
    bridge.token = Homey.ManagerSettings.get(`bridge_token_${bridge.id}`);
    console.log('bridge.token', bridge.token)
    bridge
      .on('__log', (...args) => this.log('[Bridge]', `[${bridge.id}]`, ...args))
      .on('__error', (...args) => this.error('[Bridge]', `[${bridge.id}]`, ...args))
      .init()
      .then(() => {
        this.bridges[bridge.id] = bridge;
        this.emit(`bridge_${bridge.id}`, bridge);
      })
      .catch(err => {
        this.error(`Bridge ${bridge.id} init failed:`, err);
      });
  }
  
  async onFlowActionSetScene( args ) {
    const bridge = await this.getBridge(args.scene.bridge_id, false);
    return bridge.setScene({ id: args.scene.id });
  }
  
  async onFlowSceneAutocomplete( query ) {    
    if( !Object.keys(this.bridges).length )
      throw new HueError('no_bridges');
    
    const fns = Object.values(this.bridges).map(bridge => {
      return bridge.getScenes()
        .then(scenes => ({ bridge, scenes }))
        .catch(err => err);
    });

    return Promise.all(fns).then(results => {
      const resultArray = [];

      results.forEach(result => {
        if( result instanceof Error ) return;
        const { bridge, scenes } = result;
        
        Object.keys(scenes).forEach(sceneId => {
          const scene = scenes[sceneId];
          resultArray.push({
            id: sceneId,
            bridge_id: bridge.id,
            name: scene.name.split(' on ')[0],
            description: bridge.name,
          })
        });
      });
      
      return resultArray.filter(resultArrayItem => {
        return resultArrayItem.name.toLowerCase().includes( query.toLowerCase() );
      });
    });    
  }
  
  async onFlowActionGroupOn( args ) {
    const bridge = await this.getBridge(args.group.bridge_id, false);
    return bridge.setGroupState({
      id: args.group.id,
      state: {
        on: true,
      },
    });
  }
  
  async onFlowActionGroupOff( args ) {
    const bridge = await this.getBridge(args.group.bridge_id, false);
    return bridge.setGroupState({
      id: args.group.id,
      state: {
        on: false,
      },
    });
  }
  
  async onFlowActionGroupSetBrightness( args ) {
    const bridge = await this.getBridge(args.group.bridge_id, false);
    const state = {
      on: args.brightness !== 0,
      bri: parseInt(Math.floor(args.brightness / 100 * 254)),
    };
    
    if( typeof args.duration === 'number' )
      state.transitiontime = args.duration / 100;
    
    return bridge.setGroupState({
      state,
      id: args.group.id,
    });
  }
  
  async onFlowGroupAutocomplete( query ) {
    if( !Object.keys(this.bridges).length )
      throw new HueError('no_bridges');
    
    const fns = Object.values(this.bridges).map(bridge => {
      return bridge.getGroups()
        .then(groups => ({ bridge, groups }))
        .catch(err => err);
    });

    return Promise.all(fns).then(results => {
      const resultArray = [];

      results.forEach(result => {
        if( result instanceof Error ) return;
        const { bridge, groups } = result;
    
        resultArray.push({
          id: 0,
          bridge_id: bridge.id,
          name: Homey.__('all_lights'),
          description: bridge.name,
        });        
        
        Object.keys(groups).forEach(groupId => {
          const group = groups[groupId];
          resultArray.push({
            id: groupId,
            bridge_id: bridge.id,
            name: group.name,
            description: bridge.name,
          })
        });
      });
      
      return resultArray.filter(resultArrayItem => {
        return resultArrayItem.name.toLowerCase().includes( query.toLowerCase() );
      });
    });    
  }
  
}