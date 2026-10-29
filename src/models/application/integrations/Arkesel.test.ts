import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {SmsService} from './Arkesel';
const request=vi.fn(),config={apiKey:'synthetic-key',defaultSender:'PrimeLab',baseUrl:'https://sms.arkesel.com'};
describe('Arkesel v2 adapter contracts',()=>{
 beforeEach(()=>{request.mockReset();vi.stubGlobal('fetch',request);request.mockResolvedValue(new Response(JSON.stringify({status:'success',data:[]})));});afterEach(()=>vi.unstubAllGlobals());
 it('sends JSON with header credentials and explicit sandbox without query-string secrets',async()=>{await new SmsService(1,config).sendSms(['0241234567'],'Test',{sandbox:true});const [url,options]=request.mock.calls[0];expect(url).toBe('https://sms.arkesel.com/api/v2/sms/send');expect(options.headers['api-key']).toBe('synthetic-key');expect(JSON.parse(options.body)).toMatchObject({sandbox:true,recipients:['0241234567']});});
 it('rejects overlong sender overrides instead of silently truncating them',async()=>{await expect(new SmsService(1,config).sendSms(['0241234567'],'Test',{sender:'TOO-LONG-SENDER'})).rejects.toThrow('11');expect(request).not.toHaveBeenCalled();});
 it('uses V2 for the legacy single-send helper',async()=>{await new SmsService(1,config).sendSingleSms('0241234567','Test');expect(request.mock.calls[0][0]).toBe('https://sms.arkesel.com/api/v2/sms/send');});
 it('submits phone-keyed template variables to the documented template endpoint',async()=>{await new SmsService(1,config).sendTemplateSms('Hello <%name%>',{'233241234567':{name:'Ama'}});expect(JSON.parse(request.mock.calls[0][1].body).recipients).toEqual({'0241234567':{name:'Ama'}});});
 it('allows 1000 UUID reports and rejects a larger request without any network call',async()=>{const service=new SmsService(1,config);await service.getMessageReports(Array.from({length:1000},(_,i)=>'id-'+i));expect(request.mock.calls[0][0]).toContain('message-reports');request.mockClear();await expect(service.getMessageReports(Array.from({length:1001},(_,i)=>'id-'+i))).rejects.toThrow('1000');expect(request).not.toHaveBeenCalled();});
 it.each([401,402,403,422])('returns actionable confirmed provider failure %s',async status=>{request.mockResolvedValue(new Response(JSON.stringify({status:'error'}),{status}));const result=await new SmsService(1,config).sendSms(['0241234567'],'Test');expect(result).toMatchObject({status:'error',code:status,uncertain:false});});
 it('treats unreadable acceptance and network failures as unknown, not retryable rejection',async()=>{request.mockResolvedValue(new Response('unreadable'));expect((await new SmsService(1,config).sendSms(['0241234567'],'Test')).uncertain).toBe(true);});
 it('exposes balance/secret reads separately from explicit rotation',async()=>{const service=new SmsService(1,config);request.mockImplementation(async()=>new Response(JSON.stringify({status:'success',data:{}})));await service.getBalance();await service.getWebhookSecret();await service.rotateWebhookSecret();expect(request.mock.calls.map(row=>[row[0],row[1].method])).toEqual([[config.baseUrl+'/api/v2/clients/balance-details','GET'],[config.baseUrl+'/api/v2/webhooks/secret','GET'],[config.baseUrl+'/api/v2/webhooks/secret/rotate','POST']]);});
});

describe('SmsService', () => {
     afterEach(() => vi.unstubAllGlobals());

     it('uses the supplied tenant provider configuration when sending', async () => {
          const fetchMock = vi.fn().mockResolvedValue({
               ok: true,
               json: async () => ({ status: 'success', code: 200 }),
          });
          vi.stubGlobal('fetch', fetchMock);
          const service = new SmsService(123456, {
               apiKey: 'tenant-api-key',
               defaultSender: 'PrimeLab',
               baseUrl: 'https://sms.arkesel.com',
          });

          await service.sendSms(['0241234567'], 'Result ready');

          expect(fetchMock).toHaveBeenCalledWith('https://sms.arkesel.com/api/v2/sms/send', expect.objectContaining({
               headers: expect.objectContaining({ 'api-key': 'tenant-api-key' }),
               body: JSON.stringify({
                    sender: 'PrimeLab',
                    message: 'Result ready',
                    recipients: ['0241234567'],
               }),
          }));
     });
});

it('avoids duplicating the V2 path for an existing provider base URL containing /api/v2',async()=>{const fetchMock=vi.fn(async(..._args:any[])=>new Response(JSON.stringify({status:'success',data:[]})));vi.stubGlobal('fetch',fetchMock);try{await new SmsService(1,{...config,baseUrl:'https://sms.arkesel.com/api/v2'}).sendSms(['0241234567'],'Test');expect(fetchMock.mock.calls[0][0]).toBe('https://sms.arkesel.com/api/v2/sms/send');}finally{vi.unstubAllGlobals();}});

it('creates a contact group and adds explicit fields without calling an SMS sending endpoint',async()=>{
 const fetchMock=vi.fn(async(..._args:any[])=>new Response(JSON.stringify({status:'success'})));vi.stubGlobal('fetch',fetchMock);
 try{const service=new SmsService(7,config);await service.createContactGroup('PLS-7-selected-test');await service.addContactsToGroup('PLS-7-selected-test',[{phone_number:'0241234567',first_name:'Selected Name'}]);
 expect(fetchMock.mock.calls.map(call=>call[0])).toEqual(['https://sms.arkesel.com/api/v2/contacts/groups','https://sms.arkesel.com/api/v2/contacts']);
 expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({group_name:'PLS-7-selected-test',contacts:[{phone_number:'0241234567',first_name:'Selected Name'}]});
 await expect(service.addContactsToGroup('PLS-7-selected-test',Array.from({length:201},()=>({phone_number:'0241234567'})))).rejects.toThrow('200');expect(fetchMock).toHaveBeenCalledTimes(2);
 }finally{vi.unstubAllGlobals();}
});

it('reports the known missing-group rejection without exposing arbitrary provider content',async()=>{
 const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({status:'error',message:'The group name provided does not exist!'}),{status:422}));vi.stubGlobal('fetch',fetchMock);
 try{const result=await new SmsService(7,config).addContactsToGroup('PLS-7-selected-test',[{phone_number:'0241234567'}]);expect(result.message).toContain('configured API account');expect(result.status).toBe('error');
 fetchMock.mockResolvedValue(new Response(JSON.stringify({status:'error',message:'Private customer 0241234567'}),{status:422}));expect((await new SmsService(7,config).addContactsToGroup('PLS-7-selected-test',[{phone_number:'0241234567'}])).message).not.toContain('0241234567');
 }finally{vi.unstubAllGlobals();}
});

describe('Arkesel contact subscription compatibility',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it.each(['ok','105'])('accepts membership acknowledgement %s without sending SMS',async code=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({code})));vi.stubGlobal('fetch',fetchMock);
  const result=await new SmsService(7,config).addContactToGroupCompatibility('PLS-7-selected-test',{phone_number:'0241234567'});
  expect(result.status).toBe('success');const [value,options]=fetchMock.mock.calls[0];const url=new URL(value);expect(url.pathname).toBe('/contacts/api');expect(url.searchParams.get('action')).toBe('subscribe-us');expect(url.searchParams.get('phone_number')).toBe('233241234567');expect(url.searchParams.has('first_name')).toBe(false);expect(options.redirect).toBe('error');
 });
 it('does not expose credential-bearing errors or provider contact data',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('https://provider/?api_key=secret&phone_number=private')));
  const result=await new SmsService(7,config).addContactToGroupCompatibility('PLS-7-selected-test',{phone_number:'0241234567'});expect(result.uncertain).toBe(true);expect(JSON.stringify(result)).not.toMatch(/secret|private/);
 });
 it('holds unknown responses and blocks known rejections without claiming membership',async()=>{
  const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({code:'unrecognized',message:'private'})));vi.stubGlobal('fetch',fetchMock);const service=new SmsService(7,config);
  expect((await service.addContactToGroupCompatibility('PLS-7-selected-test',{phone_number:'0241234567'})).uncertain).toBe(true);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({code:'104'})));expect(await service.addContactToGroupCompatibility('PLS-7-selected-test',{phone_number:'0241234567'})).toMatchObject({status:'error',uncertain:false,code:422});
 });
 it('rejects insecure transport before including credentials in a request',async()=>{
  const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);await expect(new SmsService(7,{...config,baseUrl:'http://provider.test'}).addContactToGroupCompatibility('PLS-7-selected-test',{phone_number:'0241234567'})).rejects.toThrow('HTTPS');expect(fetchMock).not.toHaveBeenCalled();
 });
});
