import { analyze } from "./.build/vad.mjs";
const SR=16000; let seed=1; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32-0.5;};
// «речь»: амплитудно-модулированные гармоники 150 Гц + шум
const speech=(len,amp)=>{const o=new Float32Array(len);for(let i=0;i<len;i++){const t=i/SR;const env=0.6+0.4*Math.sin(2*Math.PI*4*t);o[i]=amp*env*(Math.sin(2*Math.PI*150*t)+0.5*Math.sin(2*Math.PI*300*t)+0.3*Math.sin(2*Math.PI*900*t))/1.8;}return o;};
const build=(parts,noiseAmp)=>{const total=parts.reduce((a,p)=>a+(p.len),0);const out=new Float32Array(total);let o=0;for(const p of parts){const s=p.amp?speech(p.len,p.amp):new Float32Array(p.len);for(let i=0;i<p.len;i++)out[o+i]=s[i]+noiseAmp*rnd()*2;o+=p.len;}return out;};
const ms=(m)=>m*SR/1000;
const cases=[
 ["тишина+шум",[{len:ms(2500),amp:0}],0.004,false],
 ["громкий шум (кухня), без речи",[{len:ms(2500),amp:0}],0.05,false],
 ["ближняя речь",[{len:ms(500),amp:0},{len:ms(1200),amp:0.30},{len:ms(900),amp:0}],0.004,true],
 ["только далёкая речь (−28 дБ)",[{len:ms(500),amp:0},{len:ms(1200),amp:0.012},{len:ms(900),amp:0}],0.003,false],
 ["ближняя + далёкий голос после",[{len:ms(500),amp:0},{len:ms(1100),amp:0.30},{len:ms(1000),amp:0},{len:ms(1200),amp:0.02},{len:ms(600),amp:0}],0.003,true],
 ["далёкий голос ДО ближней",[{len:ms(400),amp:0},{len:ms(1000),amp:0.02},{len:ms(900),amp:0},{len:ms(1100),amp:0.30},{len:ms(700),amp:0}],0.003,true],
 ["короткий щелчок",[{len:ms(600),amp:0},{len:ms(100),amp:0.5},{len:ms(1500),amp:0}],0.004,false],
 ["тихая ближняя речь (шёпот рядом)",[{len:ms(500),amp:0},{len:ms(1200),amp:0.06},{len:ms(800),amp:0}],0.003,true],
];
let pass=0;
for(const [name,parts,n,expectOk] of cases){const a=analyze(build(parts,n),SR);const kept=a.range?((a.range[1]-a.range[0])/SR).toFixed(2)+"с":"-";const good=a.ok===expectOk;pass+=good;console.log((good?"OK  ":"FAIL"),name.padEnd(36),"ok="+a.ok,a.reason??"","snr="+a.snrDb.toFixed(0)+"дБ","далёких отброшено="+a.droppedFar,"оставлено="+kept);}
console.log(`${pass}/${cases.length}`);
