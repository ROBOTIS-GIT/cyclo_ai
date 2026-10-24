// Real SDK backend, loaded only after explicit operator enablement and config.
// No live serial access is part of development/testing of this release.
export async function sdkProvider() {
  const base=new URL('../firmware/upstream/tools/cyclo_firmware_sdk/dist/',import.meta.url);
  let NodeSerialTransport,PacketSession,DynamixelClient;
  try {
    ({NodeSerialTransport}=await import(new URL('node-serial-transport.js',base)));
    ({PacketSession}=await import(new URL('session.js',base)));
    ({DynamixelClient}=await import(new URL('dynamixel-client.js',base)));
  } catch {throw Error('Device runtime is not built. Run npm run build:device-runtime in this package; no device is accessed by that build.');}
  return {
    ports:()=>NodeSerialTransport.listPorts(),
    connect:async(port,baud,timeoutMs=100)=>{
      const session=new PacketSession(new NodeSerialTransport({path:port,baudRate:baud}));
      await session.open();
      const dxl=new DynamixelClient(session);
      const select=id=>{dxl.setId(id);return dxl;};
      return {
        ping:id=>select(id).ping(timeoutMs),
        probe:async id=>{try{return await select(id).ping(timeoutMs);}catch(e){if(e.message==='packet timeout')return null;throw e;}},
        read:(id,address,size)=>select(id).read(address,size,timeoutMs),
        write:(id,address,data)=>select(id).write(address,data,timeoutMs),
        close:()=>session.close()
      };
    }
  };
}
