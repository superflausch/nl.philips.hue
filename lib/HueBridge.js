'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const PromiseQueue = require('promise-queue');
const HueError = require('./HueError');

const POLL_INTERVAL = {
  'BSB001': 5000,
  'BSB002': 2000,
  'DEFAULT': 1500,
};
const API_QUEUE_LENGTH = {
  'BSB001': 2,
  'BSB002': 6,
  'DEFAULT': 6,
};

module.exports = class HueBridge extends Homey.SimpleClass {
    
  constructor({ id, address }) {
    super();
    
    // Bridge data
    this.id = id;
    this.address = address;
    this.name = null;
    this.model = null;
    this.token = null;
    
    // Registered devices
    this.devices = {};
    
    // Polling
    this.pollInterval = null;
    this._onPoll = this._onPoll.bind(this);
    
    // API Queue
    this.pq = new PromiseQueue(API_QUEUE_LENGTH['DEFAULT']);
  }
  
  get icon() {
    if( this.model === 'BSB001' ) return 'icons/BSB001.svg';
    if( this.model === 'BSB002' ) return 'icons/BSB002.svg';
    return null;
  }
  
  get connected() {
    return !!this.name;
  }
  
  get authenticated() {
    return this.connected && !!this.token;
  }
  
  async _call({ method = 'get', path, json, headers = {}, token = this.token }) {
    return this.pq.add(() => {
      return Promise.resolve().then(async () => {
        const opts = {
          method,
          headers,
        }
        
        if( typeof json === 'object' && (method === 'post' || method === 'put') ) {
          opts.body = JSON.stringify(json);
          opts.headers['Content-Type'] = 'application/json';
        }
        
        if(typeof token !== 'string')
          token = 'homey';
        
        const url = `http://${this.address}/api/${token}${path}`;
        const res = await fetch(url, opts);
        if(!res.ok)
          throw new Error(res.status);
          
        if(res.status === 204)
          return;
        
        const body = await res.json();
        if( body.error )
          throw new HueError(body.error.description, {
            type: body.error.type,
          });
        
        if( Array.isArray(body) && body.length && body[0].error ) {
          throw new HueError(body[0].error.description, {
            type: body[0].error.type,
          });
        }      
          
        return body;
      });
    });
  }
  
  async _get({ path, ...args }) {
    return this._call({ method: 'get', path, ...args });
  }
  
  async _put({ path, json, ...args }) {
    return this._call({ method: 'put', path, json, ...args });
  }
  
  async _post({ path, json, ...args }) {
    return this._call({ method: 'post', path, json, ...args });
  }
  
  async _delete({ path, ...args }) {
    return this._call({ method: 'delete', path, ...args });
  }
  
  async init() {
    const {
      name,
      modelid,
    } = await this.getConfig();
    
    this.name = name;
    this.model = modelid;
    
    const queueLength = API_QUEUE_LENGTH[this.model] || API_QUEUE_LENGTH['DEFAULT'];
    this.pq.maxPendingPromises = queueLength;
    
    this.log(`Name: ${name}, Model ID: ${this.model}`);
    
    if( this.token )
      await this.getFullState();
  }
  
  /*
   * Polling
   */
  enablePolling() {
    if( this.pollInterval ) return;
    if( !this.model ) return;
    
    this.log('Enabling polling...');    
    this.pollInterval = setInterval(this._onPoll, POLL_INTERVAL[this.model] || POLL_INTERVAL['DEFAULT']);
    this._onPoll();
  }
  
  disablePolling() {
    this.log('Disabling polling...');
    if(this.pollInterval)
      clearInterval(this.pollInterval);
  }
  
  _onPoll() {
    this.getFullState().then(state => {      
      for( let uniqueid in this.devices ) {
        const {
          type,
          onPoll,
        } = this.devices[uniqueid];
        
        const devices = state[`${type}s`];
        if(!devices) continue;
        
        const device = Object.values(devices).find(device => device.uniqueid === uniqueid);
        if( device ) {
          try {
            onPoll({
              device,
              state,
            });
          } catch( err ) {
            this.error(err);
          }
        }
      }
    }).catch(err => {
      for( let uniqueid in this.devices ) {
        const {
          onError,
        } = this.devices[uniqueid];
        onError(err);
      }
    });
  }
  
  /*
   * Device registration
   */
  registerDevice({ uniqueid, type, onPoll, onError }) {
    if(!this.state)
      throw new HueError('missing_state');
      
    const devices = this.state[`${type}s`];
    const deviceId = Object.keys(devices).find(deviceId => devices[deviceId].uniqueid === uniqueid);
    if(!deviceId)
      throw new HueError('invalid_id');
    
    this.devices[uniqueid] = {
      type,
      onPoll,
      onError,
    }
    
    if( onPoll )
      this.enablePolling();
    
    return deviceId;
  }
  
  unregisterDevice({ uniqueid }) {
    delete this.devices[uniqueid];
  }
  
  /*
   * Configuration
   */
  
  async getConfig() {
    return this._get({
      path: '/config',
    });
  }
  
  async createUser({ devicetype = 'homey' } = {}) {    
    return this._post({
      token: '',
      path: '/',
      json: {
        devicetype,
      }
    }).then(result => {
      return result[0].success.username;
    });
  }
  
  async getFullState() {
    return this._get({
      path: '/',
    }).then(state => {
      this.state = state;
      return this.state;
    });
  }
  
  /*
   * Lights
   */
  
  async getLights() {
    return this._get({
      path: '/lights',
    });
  }
  
  async setLightName({ id, name }) {
    return this._put({
      path: `/lights/${id}`,
      json: {
        name,
      },
    });    
  }
  
  async setLightState({ id, state }) {
    return this._put({
      path: `/lights/${id}/state`,
      json: {
        ...state,
      },
    });
  }
  
  /*
   * Groups
   */
  
  async getGroups() {
    return this._get({
      path: '/groups',
    });
  }
  
  async setGroupState({ id, state }) {
    return this._put({
      path: `/groups/${id}/action`,
      json: {
        ...state,
      },
    });    
  }
  
  /*
   * Scenes
   */
  
  async getScenes() {
    return this._get({
      path: '/scenes',
    });
  }
  
  async setScene({ id }) {
    return this.setGroupState({
      id: 0,
      state: {
        scene: id,
      },
    })
  }
  
  /*
   * Sensors
   */
  
  async getSensors() {
    return this._get({
      path: '/sensors',
    });
  }
  
  async setSensorConfig({ id, config }) {
    return this._put({
      path: `/sensors/${id}/config`,
      json: {
        ...config,
      },
    });    
  }    

}