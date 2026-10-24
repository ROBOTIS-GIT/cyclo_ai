import {writeFile} from 'node:fs/promises';
import {unlinkSync} from 'node:fs';
const mockPort='/tmp/cyclo-workflow-' + process.pid;
await writeFile(mockPort,'',{flag:'wx'});
process.on('exit',()=>{try{unlinkSync(mockPort);}catch{}});
import { deviceWorkflow, scanSerialDevices } from '../../../cyclo_firmware_sdk/dist/device-workflow.js';
import { PacketSession } from '../../../cyclo_firmware_sdk/dist/session.js';
import { DynamixelClient } from '../../../cyclo_firmware_sdk/dist/dynamixel-client.js';
import { buildPacket, parsePacket, Instruction, RESERVED_DXL } from '../../../cyclo_firmware_sdk/dist/protocol.js';
import { TransportClosureError } from '../../../cyclo_firmware_sdk/dist/transport.js';
export function mockBus(options = {}) {
  const memory = new Uint8Array(256); memory[8] = 3; memory[9] = 250; memory[64] = options.torque ?? 0;
  const events = []; let active = false; let deviceBaud = 1000000;
  let connections = 0, baudReadbackDropped = false;
  const connect = async baud => {
    if (active) throw Error('Bus reopened before closure');
    const attempt = ++connections;
    if (options.openFailures?.includes(attempt)) {
      events.push({openFailed:baud});
      if (options.openCleanupFailure || options.openCleanupFailures?.includes(attempt)) {
        active=true;
        throw new TransportClosureError('mock open cleanup unconfirmed');
      }
      throw Error('mock open timeout');
    }
    const handlers = new Set();
    const transport = {
      isOpen:false,
      async open() { active=true; this.isOpen=true; events.push({open:baud}); },
      async close() { if(options.closeFailure) {events.push({closeFailed:baud});throw Error('mock close failure');} await new Promise(r=>setTimeout(r,1)); active=false; this.isOpen=false;events.push({close:baud}); },
      onData(handler) {handlers.add(handler);return()=>handlers.delete(handler);},
      async write(bytes) {
        const packet=parsePacket(bytes);events.push({baud,instruction:packet.instruction,params:Array.from(packet.params)});
        if(baud!==deviceBaud)return;
        let data;
        if(packet.instruction===Instruction.DxlPing && options.delayPing && packet.id===8) await new Promise(r=>setTimeout(r,1000));
        if(packet.instruction===Instruction.DxlPing) {
          if(options.dropInitialPing && attempt===1)return;
          const model=baud===2000000 ? options.reconnectModel ?? options.model ?? 1200 : options.model ?? 1200;
          const firmware=baud===2000000 ? options.reconnectFirmware ?? options.firmware ?? 52 : options.firmware ?? 52;
          data=[0,model%256,Math.floor(model/256),firmware];
        }
        else if(packet.instruction===Instruction.DxlRead) {
          const address=packet.params[0]+256*packet.params[1];
          if(options.dropSnapshot && attempt===1 && address===64)return;
          if(options.dropBaudReadback && baud===2000000 && address===8 && !baudReadbackDropped) {baudReadbackDropped=true;return;}
          data=[0,...memory.slice(address,address+packet.params[2]+256*packet.params[3])];
        }
        else if(packet.instruction===Instruction.DxlWrite) {
          const address=packet.params[0]+256*packet.params[1];
          if(options.writeFailure==='before')throw Error('mock write timeout before acceptance');
          if(options.delayWrite) await new Promise(r=>setTimeout(r,1000));
          if(!options.ignoreWrite)memory.set(packet.params.slice(2),address);
          if(address===8 && !options.ignoreWrite) deviceBaud=options.badBaud ? 57600 : [9600,57600,115200,1000000,2000000,3000000,4000000][memory[8]];
          if(options.writeFailure==='after')throw Error('mock write timeout after acceptance');
          if(options.missingAck)return;
          data=[0];
        }
        if(data)for(const handler of handlers)handler(buildPacket(packet.id,Instruction.Status,Uint8Array.from(data),RESERVED_DXL));
      },
    };
    const session=new PacketSession(transport);await session.open();
    return {dxl:new DynamixelClient(session,1),close:()=>session.close()};
  };
  const runner = async (args,signal,onProgress) => {
    const arg = key=>args[args.indexOf(key)+1];
    if(args[0]==='serial-scan')return scanSerialDevices(connect,arg('--ids').split(',').map(Number),arg('--bauds').split(',').map(Number),20,{budgetMs:args.includes('--budget')?Number(arg('--budget')):12000,signal,onProgress});
    return deviceWorkflow(connect,{id:Number(arg('--id')),baud:Number(arg('--baud')),expectedModel:args.includes('--expected-model')?Number(arg('--expected-model')):undefined,expectedFirmware:args.includes('--expected-firmware')?Number(arg('--expected-firmware')):undefined,changes:JSON.parse(arg('--changes')),timeoutMs:20});
  };
  return {connect,runner,memory,events};
}
export const workflowConfig={allowHardwareReads:true,targets:{bench:{transport:'uart-rs485',port:mockPort,timeoutMs:50,allowScan:true,devices:[{id:1,model:1200,firmware:52,writableRegisters:['returnDelayTime','baudRate','led']}]}}};
