// Curated constants, never generated from retrieved page text. See sources.json.
export const MODELS = Object.freeze({
  1200: Object.freeze({name:'XL330-M288-T',protocol:2,firmwares:[52],bauds:[9600,57600,115200,1000000,2000000,3000000,4000000],profileModes:[3,4],source:'xl330'}),
  1020: Object.freeze({name:'XM430-W350-T/R',protocol:2,firmwares:[42],bauds:[9600,57600,115200,1000000,2000000,3000000,4000000,4500000],profileModes:[3,4,5],source:'xm430'})
});
export const REGISTERS = Object.freeze({
  id:{address:7,size:1,eeprom:true},baud:{address:8,size:1,eeprom:true},
  drive:{address:10,size:1,eeprom:true},led:{address:65,size:1,eeprom:false},
  profileAcceleration:{address:108,size:4,eeprom:false},profileVelocity:{address:112,size:4,eeprom:false}
});
export const READS = Object.freeze({model:[0,2],firmware:[6,1],id:[7,1],baud:[8,1],drive:[10,1],operatingMode:[11,1],secondaryId:[12,1],protocol:[13,1],velocityLimit:[44,4],torque:[64,1],led:[65,1],profileAcceleration:[108,4],profileVelocity:[112,4]});
export const SCAN_BAUDS = [...new Set(Object.values(MODELS).flatMap(m=>m.bauds))];
export function modelFor(number,firmware) {
  const model=MODELS[number];
  if(!model)throw Error('Unsupported model number: no configuration register map is approved');
  if(!model.firmwares.includes(firmware))throw Error('Unreviewed firmware: configuration is blocked; obtain a source-backed registry review, not a force override');
  return model;
}
export function encode(value,size) {const b=new Uint8Array(size);for(let i=0;i<size;i++)b[i]=(value/2**(i*8))&255;return b;}
export function decode(b) {return b.reduce((n,v,i)=>n+v*2**(8*i),0);}
