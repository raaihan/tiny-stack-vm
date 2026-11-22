// tiny-stack-vm: a tiny stack virtual machine for make.fun's stack ISA.
// Values are 32-bit wrapping ints; data stack 256, call stack 64, memory 256
// words. Ten traps (exit codes 2-11), step limit 1e6, output limit 65536.
// Driver: reads /input/<id>/program.bin + input.bin, writes
// /output/<id>/stdout.bin + exit.txt for i001..i040.
const fs=require('node:fs');
function run(P,I){
 const M=new Int32Array(256),S=[],C=[];
 let pc=0,ip=0,steps=0;
 const out=[];
 const n=P.length;
 for(;;){
  if(steps>=1000000)return[10,out];
  if(pc<0||pc>=n)return[9,out];
  const o=P[pc];
  let L=0;
  if(o===1)L=1;else if(o===2)L=4;else if(o>=48&&o<=51)L=2;
  if(!(o<=7||(o>=16&&o<=30)||(o>=32&&o<=34)||(o>=48&&o<=52)||o===64||o===65||(o>=80&&o<=83)))return[5,out];
  if(pc+1+L>n)return[9,out];
  steps++;
  const nx=pc+1+L;
  let a,b;
  switch(o){
   case 0:return[0,out];
   case 1:
    if(S.length>255)return[3,out];
    S.push((P[pc+1]<<24)>>24);pc=nx;break;
   case 2:
    if(S.length>255)return[3,out];
    S.push(P.readInt32LE(pc+1));pc=nx;break;
   case 3:
    if(S.length<1)return[2,out];
    S.pop();pc=nx;break;
   case 4:
    if(S.length<1)return[2,out];
    if(S.length>255)return[3,out];
    S.push(S[S.length-1]);pc=nx;break;
   case 5:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(b);S.push(a);pc=nx;break;
   case 6:
    if(S.length<2)return[2,out];
    if(S.length>255)return[3,out];
    b=S.pop();a=S.pop();S.push(a);S.push(b);S.push(a);pc=nx;break;
   case 7:
    if(S.length<3)return[2,out];
    const c=S.pop();b=S.pop();a=S.pop();S.push(b);S.push(c);S.push(a);pc=nx;break;
   case 16:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push((a+b)|0);pc=nx;break;
   case 17:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push((a-b)|0);pc=nx;break;
   case 18:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(Math.imul(a,b));pc=nx;break;
   case 19:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();
    if(b===0)return[4,out];
    S.push(Math.trunc(a/b)|0);pc=nx;break;
   case 20:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();
    if(b===0)return[4,out];
    S.push((a%b)|0);pc=nx;break;
   case 21:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();
    if(b===0)return[4,out];
    S.push(Math.floor((a>>>0)/(b>>>0))|0);pc=nx;break;
   case 22:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();
    if(b===0)return[4,out];
    S.push(((a>>>0)%(b>>>0))|0);pc=nx;break;
   case 23:
    if(S.length<1)return[2,out];
    S.push((-S.pop())|0);pc=nx;break;
   case 24:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a&b);pc=nx;break;
   case 25:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a|b);pc=nx;break;
   case 26:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a^b);pc=nx;break;
   case 27:
    if(S.length<1)return[2,out];
    S.push(~S.pop());pc=nx;break;
   case 28:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a<<(b&31));pc=nx;break;
   case 29:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a>>(b&31));pc=nx;break;
   case 30:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push((a>>>(b&31))|0);pc=nx;break;
   case 32:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a===b?1:0);pc=nx;break;
   case 33:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push(a<b?1:0);pc=nx;break;
   case 34:
    if(S.length<2)return[2,out];
    b=S.pop();a=S.pop();S.push((a>>>0)<(b>>>0)?1:0);pc=nx;break;
   case 48:
    pc=nx+P.readInt16LE(pc+1);break;
   case 49:
    if(S.length<1)return[2,out];
    if(S.pop()===0)pc=nx+P.readInt16LE(pc+1);else pc=nx;break;
   case 50:
    if(S.length<1)return[2,out];
    if(S.pop()!==0)pc=nx+P.readInt16LE(pc+1);else pc=nx;break;
   case 51:
    if(C.length>=64)return[7,out];
    C.push(nx);pc=P.readUInt16LE(pc+1);break;
   case 52:
    if(!C.length)return[8,out];
    pc=C.pop();break;
   case 64:
    if(S.length<1)return[2,out];
    a=S.pop();
    if(a<0||a>255)return[6,out];
    S.push(M[a]);pc=nx;break;
   case 65:
    if(S.length<2)return[2,out];
    a=S.pop();b=S.pop();
    if(a<0||a>255)return[6,out];
    M[a]=b;pc=nx;break;
   case 80:
    if(S.length<1)return[2,out];
    a=S.pop();
    const s=String(a);
    if(out.length+s.length>65536)return[11,out];
    for(let i=0;i<s.length;i++)out.push(s.charCodeAt(i));
    pc=nx;break;
   case 81:
    if(S.length<1)return[2,out];
    if(out.length>=65536)return[11,out];
    out.push(S.pop()&255);pc=nx;break;
   case 82:
    if(S.length>255)return[3,out];
    S.push(ip<I.length?I[ip++]:-1);pc=nx;break;
   case 83:
    if(S.length<1)return[2,out];
    return[S.pop()&255,out];
  }
 }
}
for(let i=1;i<=40;i++){
 const id='i'+String(i).padStart(3,'0');
 const P=fs.readFileSync('/input/'+id+'/program.bin');
 const I=fs.readFileSync('/input/'+id+'/input.bin');
 const r=run(P,I);
 fs.mkdirSync('/output/'+id,{recursive:true});
 fs.writeFileSync('/output/'+id+'/stdout.bin',Buffer.from(r[1]));
 fs.writeFileSync('/output/'+id+'/exit.txt',String(r[0])+'\n');
}
