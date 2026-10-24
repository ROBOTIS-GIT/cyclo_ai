const mode = process.argv[2];
if(mode==='ok') console.log(JSON.stringify({args:process.argv.slice(3),nodeOptions:process.env.NODE_OPTIONS ?? null}));
else if(mode==='invalid') console.log('not JSON');
else if(mode==='error') {console.error('sensitive stderr should not be exposed');process.exitCode=2;}
else if(mode==='large') console.log('x'.repeat(10000));
else if(mode==='wait') setTimeout(()=>console.log('{}'),30000);
else if(mode==='ignore-term') { process.on('SIGTERM',()=>{}); console.error('ready'); setTimeout(()=>console.log('{}'),30000); }
