import {convert,MAX_BYTES} from './conversion.js';
const $=id=>document.getElementById(id);let result=null;
const message=text=>{$('status').textContent=text;};
function invalidate(){result=null;$('output').value='';$('copy').disabled=true;$('download').disabled=true;}
$('input').addEventListener('input',invalidate);$('operation').addEventListener('change',()=>{invalidate();message('Choose a tool and convert your data.');});
$('sample').addEventListener('click',()=>{invalidate();$('input').value=$('operation').value==='csv-to-json'?'name,role,city\nAda,Engineer,London\nGrace,Scientist,New York':JSON.stringify([{name:'Ada',role:'Engineer',city:'London'},{name:'Grace',role:'Scientist',city:'New York'}],null,2);message('Example loaded. Click Convert data.');});
$('convert').addEventListener('click',()=>{invalidate();try{result=convert($('operation').value,$('input').value);$('output').value=result.output;$('copy').disabled=false;$('download').disabled=false;message('Done. Your data was processed locally—nothing was uploaded.');}catch(e){message(e.message);}});
$('clear').addEventListener('click',()=>{invalidate();$('input').value='';$('file').value='';message('Cleared. Your data stays in this browser.');});
$('file').addEventListener('change',async()=>{const file=$('file').files[0];if(!file)return;invalidate();if(file.size>MAX_BYTES){message('File exceeds 128 KiB.');return;}try{$('input').value=await file.text();message('File opened locally. Click Convert data.');}catch(_){message('Unable to read that file.');}});
$('copy').addEventListener('click',async()=>{if(!result)return;try{await navigator.clipboard.writeText(result.output);message('Result copied.');}catch(_){$('output').focus();$('output').select();message('Select the result and copy it manually. Clipboard access was unavailable.');}});
$('download').addEventListener('click',()=>{if(!result)return;const url=URL.createObjectURL(new Blob([result.output],{type:result.mimeType+';charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='datashift-result.'+result.extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Download started.');});
