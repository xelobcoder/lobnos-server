// Read-only by default. Prints aggregate evidence only; never logs patient identifiers or full rows.
require('dotenv').config({quiet:true});
const {spawn}=require('child_process'),readline=require('readline'),crypto=require('crypto');
const knex=require('knex');
const conn={host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USERNAME,password:process.env.DB_PASSWORD,database:process.env.DATABASE};
if(!['localhost','127.0.0.1','::1'].includes(conn.host))throw Error('Recovery is restricted to the local database');
const db=knex({client:'mysql2',connection:conn});
const bin='C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqlbinlog.exe';
const history=[];let sequence=0,roundingEvent=null,current=null,section=null,statement='';let firstTimestamp=null;
const clean=v=>{v=v.replace(/\s*\/\*.*$/,'').trim();return v.startsWith("'")&&v.endsWith("'")?v.slice(1,-1).replace(/\\'/g,"'").replace(/\\\\/g,'\\'):v};
function flush(){if(current){history.push(current);current=null;section=null}}
function line(value,log){
 const stamp=value.match(/^#(\d{6})\s+(\d{1,2}):(\d{2}):(\d{2})/);if(stamp&&!firstTimestamp)firstTimestamp='20'+stamp[1].slice(0,2)+'-'+stamp[1].slice(2,4)+'-'+stamp[1].slice(4,6)+'T'+stamp[2].padStart(2,'0')+':'+stamp[3]+':'+stamp[4]+'Z';
 const match=value.match(/^### (INSERT INTO|UPDATE|DELETE FROM) `([^`]+)`\.`dbovitalsigns`/);
 if(match){flush();if(match[2]===conn.database)current={kind:match[1],before:{},after:{},log,sequence:++sequence};return;}
 if(value.startsWith('### ')){if(!current)return;if(value==='### WHERE'){section='before';return}if(value==='### SET'){section='after';return}const m=value.match(/^###\s+@(\d+)=(.*)$/);if(m&&section)current[section][m[1]]=clean(m[2]);return;}
 if(current)flush();
 if(value.startsWith('#')||value==='')return;
 statement=(statement+' '+value).slice(-12000);
 if(value.includes('/*!*/;')){
  if(/alter\s+table\s+`?dbovitalsigns`?/i.test(statement)&&/`?temperature`?\s+decimal(?:\(10,\s*0\))?\s+null/i.test(statement)&&!roundingEvent)roundingEvent={log,sequence:++sequence};
  statement='';
 }
}
async function scan(log){await new Promise((resolve,reject)=>{const child=spawn(bin,['--read-from-remote-server','--host='+conn.host,'--port='+conn.port,'--user='+conn.user,'--database='+conn.database,'--base64-output=DECODE-ROWS','--verbose','--verbose',log],{env:{...process.env,MYSQL_PWD:conn.password},windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b.toString());const rl=readline.createInterface({input:child.stdout});rl.on('line',v=>line(v,log));child.on('error',reject);child.on('close',code=>{flush();code?reject(Error('Binary log reader failed for '+log+': '+stderr.replace(/password[^\n]*/gi,'[redacted]'))):resolve()});});}
(async()=>{
 const observations=await db('dbovitalsigns').select('*',db.raw("DATE_FORMAT(date,'%Y-%m-%d %H:%i:%s') as observation_date"));
 const logs=(await db.raw('SHOW BINARY LOGS'))[0];
 for(let i=0;i<logs.length;i++){await scan(logs[i].Log_name);if((i+1)%10===0)console.log('Scanned '+(i+1)+' of '+logs.length+' local binary logs');}
 const results=[];
 for(const row of observations){let candidate=null;
  for(const event of history){if(roundingEvent&&event.sequence>=roundingEvent.sequence)continue;
   const before=event.before,after=event.after;
   if(Number(after['1']||before['1'])!==Number(row.vitalsignid))continue;
   if(event.kind==='DELETE FROM'){candidate=null;continue;}
   const snapshot={...(candidate?.snapshot||{}),...before,...after};
   if(snapshot['4']!==undefined&&/^-?\d+(?:\.\d+)?$/.test(snapshot['4']))candidate={snapshot,event};
  }
  if(!candidate)continue;
  const s=candidate.snapshot;
  const stable={1:row.vitalsignid,2:row.patientid,3:row.bp,5:row.pulse,6:row.respiration,7:row.employeeid,8:row.spo2,9:row.observation_date};
  const verified=Object.entries(stable).every(([k,v])=>s[k]!==undefined&&String(s[k])===String(v));
  const original=Number(s['4']),rounded=Number(row.temperature),consistent=Math.round(original)===rounded||original===rounded;
  results.push({row,candidate,verified,original,consistent});
 }
 console.log(JSON.stringify({earliestRetainedEvent:firstTimestamp,observations:observations.length,historyEvents:history.length,roundingDDLFound:!!roundingEvent,historyEventsBeforeRounding:history.filter(event=>roundingEvent&&event.sequence<roundingEvent.sequence).length,candidates:results.length,verifiedCandidates:results.filter(x=>x.verified&&x.consistent).length,needsFractionRecovery:results.filter(x=>x.verified&&x.consistent&&x.original!==Number(x.row.temperature)).length}));
 if(process.argv.includes('--apply'))throw Error('Recovery apply is intentionally disabled until read-only evidence is verified.');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.destroy());
