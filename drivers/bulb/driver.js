'use strict';

const Homey = require('homey');
const HueDriver = require('../../lib/HueDriver.js');

const DEFAULT_ICON	= 'LCT001';
const CAPABILITIES_MAP = {
	'on/off light': [ 'onoff' ],
	'on/off plug-in unit': [ 'onoff' ],
	'dimmable light': [ 'onoff', 'dim' ],
	'dimmable plug-in unit': [ 'onoff', 'dim' ],
	'color temperature light': [ 'onoff', 'dim', 'light_temperature' ],
	'color light': [ 'onoff', 'dim', 'light_hue', 'light_saturation' ],
	'extended color light': [ 'onoff', 'dim', 'light_hue', 'light_saturation', 'light_temperature', 'light_mode' ],
}
const ICONS_MAP = {
	'LCT001': 'LCT001',
	'LCT002': 'LCT002',
	'LCT003': 'LCT003',
	'LCT007': 'LCT001',
	'LCT011': 'LCT002',
	'LCT012': 'LCT012',
	'LLC001': 'LLC001',
	'LLC010': 'LLC010',
	'LLC011': 'LLC011',
	'LLC012': 'LLC011',
	'LLC006': 'LLC010',
	'LLC007': 'LLC007',
	'LLC013': 'LLC013',
	'LWB004': 'LCT001',
	'LWB006': 'LWB006',
	'LWB007': 'LCT001',
	'LWB010': 'LWB006',
	'LWB014': 'LWB006',
	'LLM001': DEFAULT_ICON,
	'LLM010': DEFAULT_ICON,
	'LLM011': DEFAULT_ICON,
	'LLM012': DEFAULT_ICON,
	'LLC020': 'LLC020',
	'LTW012': 'LCT012',
	'LCF005': 'LCF005',
	'LCS001': 'LCS001',
	'LCT024': 'LCT024',
	'LST001': 'LST001',
	'LST002': 'LST001',
	'LST003': 'LST001',
	'LWF001': 'LWF001',
	'LTW001': 'LCT001',
	'LTW004': 'LCT001',
	'LTW010': 'LCT001',
	'LTW011': 'LCT001',
	'LTW012': 'LCT012',
	'LTW015': 'LCT001',
	'LTW013': 'LCT003',
  'Plug 01': 'socket',
};

const ENERGY_MAP = {
  'LCT001': { approximation: { usageOff: 0.5, usageOn: 8.5, }, },
  'LCT002': { approximation: { usageOff: 0.5, usageOn: 8.0, }, },
  'LCT003': { approximation: { usageOff: 0.5, usageOn: 6.5, }, },
  'LCT007': { approximation: { usageOff: 0.5, usageOn: 9.0, }, },
  'LCT010': { approximation: { usageOff: 0.5, usageOn: 10.0, }, },
  'LCT011': { approximation: { usageOff: 0.5, usageOn: 9.0, }, },
  'LCT012': { approximation: { usageOff: 0.5, usageOn: 6.5, }, },
  'LCT015': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW001': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW004': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW010': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW011': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW012': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW013': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LTW015': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LWB004': { approximation: { usageOff: 0.5, usageOn: 9.0, }, },
  'LWB007': { approximation: { usageOff: 0.5, usageOn: 9.0, }, },
  'LWB006': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LWB010': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LWB014': { approximation: { usageOff: 0.5, usageOn: 9.5, }, },
  'LST001': { approximation: { usageOff: 0.5, usageOn: 20.0, }, },
  'LST002': { approximation: { usageOff: 0.5, usageOn: 20.0, }, },
  'LST003': { approximation: { usageOff: 0.5, usageOn: 37.5, }, },
};

const PLUG_MODEL_IDS = [
  'LOM001',
  'Plug 01',
];

module.exports = class DriverBulb extends HueDriver {
  
  static get HUE_TYPE() {
    return 'light';
  }
  
  static onPairGetDevices({ bridge }) {
    return bridge.getLights.bind(bridge);
  }
  
  static onPairListDevice({ bridge, device }) {
    if( PLUG_MODEL_IDS.includes(device.modelid)) return null; // Exclude Hue Plug
    
    const obj = {};
    
    const type = device.type.toLowerCase();
    const modelid = device.modelid;
    
    const capabilities = CAPABILITIES_MAP[type];
    if( !capabilities ) return null;
    obj.capabilities = capabilities;
    
    const icon = ICONS_MAP[modelid];
    if( icon ) obj.icon = `/icons/${icon}.svg`;
    
    return obj;
  }
  
  onInitFlow() {
		new Homey.FlowCardAction('shortAlert')
			.register()
			.registerRunListener( args => args.device.shortAlert() );
			
		new Homey.FlowCardAction('longAlert')
			.register()
			.registerRunListener( args => args.device.longAlert() );
		
		new Homey.FlowCardAction('startColorLoop')
			.register()
			.registerRunListener( args => args.device.startColorLoop() );
			
		new Homey.FlowCardAction('stopColorLoop')
			.register()
			.registerRunListener( args => args.device.stopColorLoop() );
  }
  
  getEnergy(modelId) {
    return ENERGY_MAP[modelId] || null;
  }
}