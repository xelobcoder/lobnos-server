const K=require('./dist/src/database/KnexConnections').default;(async()=>{const d=await K(957782);console.log(JSON.stringify(await d('samplestatus').columnInfo()));process.exit()})()
