'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const HueBridge = require('./HueBridge.js');

const NUPNP_URL = 'https://www.meethue.com/api/nupnp';
const DISCOVER_INTERVAL = 60000;

module.exports = class HueDiscovery extends Homey.SimpleClass {
    
  constructor() {
    super();

    this._discover = this._discover.bind(this);
    this._onBridge = this._onBridge.bind(this);
    
    this._bridges = {};
  }
  
  start() {
    if( this._discoverInterval ) clearInterval(this._discoverInterval);
    this._discoverInterval = setInterval(this._discover, DISCOVER_INTERVAL);
    this._discover();
  }
  
  stop() {
    if( this._discoverInterval ) clearInterval(this._discoverInterval);        
  }
  
  _discover() {
    fetch(NUPNP_URL).then(async res => {
      if(!res.ok)
        throw new Error(res.status);
      const bridges = await res.json();
      if(!Array.isArray(bridges))
        throw new Error('Result not Array');
      
      bridges.forEach(this._onBridge);        
    }).catch(this.error);
  }
  
  _onBridge({ id, internalipaddress: address }) {
    //this.log('_onBridge', { id, address });
    
    if( typeof id !== 'string' ) return;
    if( typeof address !== 'string' ) return;
    
    id = id.toLowerCase();
    
    if( this._bridges[id] ) {
      this._bridges[id].address = address;
    } else {
      this._bridges[id] = new HueBridge({ id, address });
      this.emit('bridge', this._bridges[id]);
      this.emit(`bridge_${id}`, this._bridges[id]);
    }
    
  }
  
  getBridges() {
    return this._bridges;
  }
  
  getBridge(id) {
    const bridge = this._bridges[id];
    if(!bridge)
      throw new Error('Unknown Bridge');
    return bridge;
  }
    
}