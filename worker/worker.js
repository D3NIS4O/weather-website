import { convert, OPERATIONS, MAX_BYTES } from '../conversion.js';
// TEST-ONLY BUILD: network and mint are intentionally not configurable to mainnet.
const NETWORK = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
const ASSET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const PAY_TO = 'ANdBMwRimMyrm1qJ3vFtixK1DQ8WgSLKBYWxvcTHCvgY';
const FACILITATOR = 'https://x402.org/facilitator';
const AMOUNT = '10000';
const WEBSITE = 'https://d3nis4o.github.io/weather-website/';
const baseHeaders = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, PAYMENT-SIGNATURE','Access-Control-Expose-Headers':'PAYMENT-REQUIRED, PAYMENT-RESPONSE'};
export const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {status,headers:{...baseHeaders,...headers}});
const encoded = value => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
let supportedCache;
async function supportedKind() {
  if (supportedCache && supportedCache.expires > Date.now()) return supportedCache.kind;
  const r = await fetch(FACILITATOR + '/supported', {signal:AbortSignal.timeout(10000)});
  if (!r.ok) throw new Error('Test payment provider is unavailable.');
  const data = await r.json();
  const kind = data.kinds?.find(k => k.x402Version === 2 && k.scheme === 'exact' && k.network === NETWORK);
  if (!kind || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(kind.extra?.feePayer || '')) throw new Error('Payment provider does not advertise Solana devnet support.');
  supportedCache = {kind,expires:Date.now()+60000}; return kind;
}
async function requirements() {
  const kind = await supportedKind();
  return {scheme:'exact',network:NETWORK,asset:ASSET,amount:AMOUNT,payTo:PAY_TO,maxTimeoutSeconds:120,extra:{feePayer:kind.extra.feePayer}};
}
function resource(url) { return {url,description:'DataShift test-only data conversion; 0.01 devnet USDC per response. No real-money payments.',mimeType:'application/json'}; }
function challenge(url, req, error='PAYMENT-SIGNATURE header is required') {
  const body = {x402Version:2,error,resource:resource(url),accepts:[req]};
  return json(body,402,{'PAYMENT-REQUIRED':encoded(body)});
}
export async function readBody(request) {
  const reader = request.body?.getReader(); if (!reader) return '';
  let bytes=0; const chunks=[];
  while (true) { const {done,value}=await reader.read(); if(done) break; bytes+=value.length; if(bytes>MAX_BYTES*2){await reader.cancel();throw new Error('Request body exceeds 256 KiB.');} chunks.push(value); }
  const joined=new Uint8Array(bytes); let offset=0; for(const c of chunks){joined.set(c,offset);offset+=c.length;} return new TextDecoder('utf-8',{fatal:true}).decode(joined);
}
export function validatePayload(header, req, url) {
  if (header.length > 16384) throw new Error('Payment header is too large.');
  const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(header), c=>c.charCodeAt(0))));
  if(payload.x402Version!==2 || !payload.accepted || !payload.payload) throw new Error('Invalid x402 version or payment payload.');
  for(const key of ['scheme','network','asset','amount','payTo','maxTimeoutSeconds']) if(payload.accepted[key]!==req[key]) throw new Error('Payment requirements do not match this test-only service.');
  if(payload.accepted.extra?.feePayer!==req.extra.feePayer || Object.keys(payload.accepted.extra || {}).some(k=>k!=='feePayer')) throw new Error('Unsupported payment extras.');
  if(payload.resource && payload.resource.url!==url) throw new Error('Payment resource does not match this request.');
  const transaction=payload.payload.transaction;
  if(typeof transaction!=='string' || transaction.length>3000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(transaction)) throw new Error('Invalid Solana transaction.');
  const binary=Uint8Array.from(atob(transaction),c=>c.charCodeAt(0));
  if(binary.length<100 || binary.length>1232 || btoa(String.fromCharCode(...binary))!==transaction) throw new Error('Invalid Solana transaction encoding.');
  return {payload,binary};
}
async function facilitator(operation, payload, req) {
  const r=await fetch(`${FACILITATOR}/${operation}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x402Version:2,paymentPayload:payload,paymentRequirements:req}),signal:AbortSignal.timeout(20000)});
  const result=await r.json();
  if(operation==='verify' && typeof result.isValid==='boolean') return result;
  if(operation==='settle' && typeof result.success==='boolean') return result;
  throw new Error('Test payment provider returned an invalid response.');
}
export class PaymentGuard {
  constructor(ctx) { this.ctx=ctx; this.queue=Promise.resolve(); }
  async fetch(request) {
    const run=this.queue.then(()=>this.handle(request)); this.queue=run.catch(()=>{}); return run;
  }
  async handle(request) {
    // Durable state is a one-use replay marker, not an access pass. Never stores conversion input/output.
    if(await this.ctx.storage.get('attempted')) return json({error:'This payment has already been used or attempted. A new payment is required.'},409);
    const {payload,req,result}=await request.json();
    let verify;
    try { verify=await facilitator('verify',payload,req); } catch(_) {return json({error:'Test payment verification unavailable. No content served.'},503);}
    if(verify.isValid!==true) return json({error:'Invalid test payment. No content served.'},402);
    await this.ctx.storage.put('attempted',true);
    let receipt;
    try {receipt=await facilitator('settle',payload,req);} catch(_) {return json({error:'Test settlement outcome unknown. No content served. Do not reuse this payment.'},503);}
    if(receipt.success!==true || receipt.network!==NETWORK || typeof receipt.transaction!=='string' || !receipt.transaction) return json({error:'Test payment settlement failed. No content served.'},402);
    return json(result,200,{'PAYMENT-RESPONSE':encoded(receipt)});
  }
}
export default {
  async fetch(request,env) {
    try {
      const url=new URL(request.url);
      if(request.method==='OPTIONS') return new Response(null,{status:204,headers:baseHeaders});
      if(url.pathname==='/' && request.method==='GET') return Response.redirect(WEBSITE,302);
      const info={name:'DataShift',mode:'test-only',realPaymentsEnabled:false,network:NETWORK,asset:ASSET,payTo:PAY_TO,price:'0.01 devnet USDC per response',accessPasses:false,operations:OPERATIONS,inputLimitBytes:MAX_BYTES,aiEntry:'/ai',conversionEndpoint:'/api/convert',website:WEBSITE};
      if(url.pathname==='/health' && request.method==='GET') {
        try {await supportedKind();return json({...info,facilitatorReady:true});} catch(e) {return json({...info,facilitatorReady:false,error:e.message},503);}
      }
      if(url.pathname==='/docs' && request.method==='GET') return json({...info,request:{method:'POST',body:{operation:'csv-to-json',input:'name,age\nAda,36'}},privacy:'Input is processed transiently. Signed test transactions go to the facilitator. Only replay markers persist. Never send secrets.'});
      if(!((url.pathname==='/ai' && request.method==='GET') || (url.pathname==='/api/convert' && request.method==='POST'))) return json({error:'Not found.'},404);
      let req;
      try{req=await requirements();}catch(e){return json({error:e.message,mode:'test-only',realPaymentsEnabled:false},503);}
      const header=request.headers.get('PAYMENT-SIGNATURE');
      if(!header) return challenge(request.url,req);
      let validated;
      try{validated=validatePayload(header,req,request.url);}catch(e){return challenge(request.url,req,e.message);}
      let result;
      if(url.pathname==='/ai') result={...info,message:'AI entry paid for this response only. Each conversion requires a separate new payment.'};
      else {
        try {
          if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({error:'Content-Type must be application/json.'},415);
          const body=JSON.parse(await readBody(request)); result=convert(body.operation,body.input);
        }catch(e){return json({error:e.message},400);}
      }
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',validated.binary)), b=>b.toString(16).padStart(2,'0')).join('');
      const guard=env.PAYMENT_GUARD.get(env.PAYMENT_GUARD.idFromName(hash));
      return guard.fetch(new Request('https://internal/payment',{method:'POST',body:JSON.stringify({payload:validated.payload,req,result})}));
    }catch(_){return json({error:'Service unavailable. No paid content served.',mode:'test-only'},503);}
  }
};
