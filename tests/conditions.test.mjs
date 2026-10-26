import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
import{MODELS,modelFor}from'../modules/dynamixel/registry.mjs';import{itemFor,writeRequest,validateConditions,tableFor}from'../modules/dynamixel/table.mjs';
const cases=JSON.parse(readFileSync(new URL('../validation/fixtures/item-condition-cases.json',import.meta.url),'utf8')).cases;
for(const c of cases)test('canonical condition: '+c.name,async()=>{
 const m=MODELS.find(m=>m.catalogId===c.catalogId),model=modelFor(m.modelNumbers[0],c.firmware,c.catalogId,c.protocol),item=itemFor(model,c.item),state={'Torque Enable':0,'Lock':0,'Operating Mode':3,'Control Mode':2,'Drive Mode':0,'Current Limit':100,'Velocity Limit':1000,'PWM Limit':1000,'Torque Limit':100,'Min Position Limit':0,'Max Position Limit':4095,'CW Angle Limit':0,'CCW Angle Limit':1023,'Controller State':0,'Bus Watchdog':0,...c.state};
 let accepted=true,error;
 try{writeRequest(model,item,c.value);await validateConditions(model,item,c.value,async name=>{if(!(name in state))throw Error('Fixture condition missing: '+name);return state[name];});}catch(e){accepted=false;error=e.message;}
 assert.equal(accepted,c.allowed,`${c.catalogId} ${c.item}: ${error}`);
});
