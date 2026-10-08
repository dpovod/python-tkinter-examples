/* Інтерактив «Двійкова система». Працює лише на сторінці /binary.html. */
(function () {
const $=id=>document.getElementById(id);
const root=document.querySelector(".bin");
if(!root)return;
const MAX=1023,MIN_FS=20;
const pw=(b,p)=>b+"<sup>"+p+"</sup>";
const tz=(v,bit)=>{let k=0;while(((v>>k)&1)===bit)k++;return k};

let V=0,P=0;

/* each digit / term / product is tagged with its base and position, so hover can link them across panels */
function cls(s,o,p,dir){
  const L=s.length,OL=o.length;
  if(p>=OL)return" new";
  if(s[L-1-p]!==o[OL-1-p])return dir>0?" up":" dn";
  return"";
}
function numHTML(base,dir){
  const s=V.toString(base),o=P.toString(base),L=s.length;let h="";
  for(let p=L-1;p>=0;p--)h+='<span class="dg'+(dir?cls(s,o,p,dir):"")+'" data-b="'+base+'" data-p="'+p+'">'+s[L-1-p]+"</span>";
  return h+"<sub>"+base+"</sub>";
}
function expHTML(base,dir){
  const s=V.toString(base),o=P.toString(base),L=s.length;let h="";
  for(let p=L-1;p>=0;p--){
    const d=s[L-1-p];
    h+='<span class="tm'+(d==="0"?" z":"")+(dir?cls(s,o,p,dir):"")+'" data-b="'+base+'" data-p="'+p+'"><span class="dg">'+d+"</span>·"+pw(base,p)+"</span>";
    if(p>0)h+='<span class="pl">+</span>'+(p===Math.ceil(L/2)?'<span class="br"></span>':"");
  }
  return h;
}
function sumHTML(base,dir){
  const s=V.toString(base),o=P.toString(base),L=s.length;let h="= ";
  for(let p=L-1;p>=0;p--){
    const d=+s[L-1-p];
    h+='<span class="pr'+(d===0?" z":"")+(dir?cls(s,o,p,dir):"")+'" data-b="'+base+'" data-p="'+p+'">'+d*Math.pow(base,p)+"</span>";
    if(p>0)h+='<span class="pl">+</span>'+(p===Math.ceil(L/2)?'<span class="br"></span>':"");
  }
  return L>1?h+" = <b>"+V+"</b>":"= <b>"+V+"</b>";
}

/* shrink a line until it fits its panel; below MIN_FS let it wrap between terms */
function fit(el){
  const box=el.parentElement,cs=getComputedStyle(box);
  const avail=box.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight);
  const base=+el.dataset.base,prev=el.style.fontSize;
  el.style.transition="none";el.style.maxWidth="none";el.style.fontSize=base+"px";
  const size=two=>{el.classList.toggle("two",two);const w=el.offsetWidth;return w>avail?base*avail/w*0.98:base};
  let two=false,fs=size(false);
  if(fs<MIN_FS&&el.querySelector(".br")){two=true;fs=size(true)}
  el.style.maxWidth="";el.style.fontSize=prev||fs+"px";
  void el.offsetWidth;
  el.style.transition="font-size .4s ease";
  el.style.fontSize=fs+"px";
}
const fitAll=()=>root.querySelectorAll(".fit").forEach(fit);

function pulse(){
  root.querySelectorAll(".eq").forEach(e=>{e.classList.remove("pulse");void e.offsetWidth;e.classList.add("pulse")});
}

function render(dir){
  $("nb").innerHTML=numHTML(2,dir);
  $("nd").innerHTML=numHTML(10,dir);
  $("xb").innerHTML=expHTML(2,dir);
  $("xd").innerHTML=expHTML(10,dir);
  $("sb").innerHTML=sumHTML(2,dir);
  $("sd").innerHTML=sumHTML(10,dir);
  $("dn").disabled=V===0;
  $("up").disabled=V===MAX;
  fitAll();
  if(dir)pulse();
}

/* column addition / subtraction in base 2: carries (+1) or the borrow dot (−1) on top, changed result digits highlighted */
function column(op,old,nv,k){
  const a=old.toString(2),r=nv.toString(2),W=Math.max(a.length,r.length);
  const cells=[];
  const row=(sign,str,cls,mark,base)=>{
    cells.push('<span class="sg '+cls+'">'+sign+"</span>");
    for(let p=W-1;p>=0;p--){
      const i=str.length-1-p,d=i>=0?str[i]:"";
      cells.push('<span class="'+cls+(mark?mark(p,d):"")+'">'+d+"</span>");
    }
    cells.push('<span class="bs '+cls+'">'+(base?"2":"")+"</span>");
  };
  const carry=Array.from({length:W},(_,i)=>{const p=W-1-i;return op>0?(p>=1&&p<=k?"1":""):(k>0&&p===k?"<b style=\"font-size:1.6em;line-height:0.5\">•</b>":"")});
  cells.push('<span class="sg cy"></span>');
  carry.forEach(c=>cells.push('<span class="cy">'+c+"</span>"));
  cells.push('<span class="bs cy"></span>');
  row("",a,"",(p,d)=>(op<0&&p>=r.length&&d)?" lz":"",true);
  row(op>0?"+":"−","1","","",true);
  row("",r,"rs",(p,d)=>{const i=a.length-1-p,od=i>=0?a[i]:"";return d&&d!==od?" ch":""},true);
  const el=$("col");
  el.style.gridTemplateColumns="auto repeat("+W+",1.1em) auto";
  el.innerHTML=cells.join("");
}

function inc(){
  if(V>=MAX)return false;
  const old=V,nv=V+1,t=tz(old,1);
  const grew=nv.toString(2).length>old.toString(2).length;
  let n;
  if(t===0)n="Остання двійкова цифра 0. 0 + 1 = 1, переносу немає. Решта цифр не змінюється.";
  else{
    n="Остання двійкова цифра 1. У двійковій системі цифри 2 немає, тому 1 + 1 = 10<sub>2</sub>: пишемо 0, а 1 переносимо в сусідній розряд ліворуч.";
    if(t>1)n+=" Там теж 1, тож усе повторюється: "+(t===2?"обидві одиниці справа стали":"усі "+t+" одиниці справа стали")+" нулями.";
    n+=grew?" Перенос дійшов до лівого краю і став новою цифрою: у числа з'явився розряд "+pw(2,t)+".":" Перенос зупинився на розряді "+pw(2,t)+", бо там був 0. Він став 1.";
  }
  P=V;V=nv;
  column(1,old,nv,t);
  $("note").innerHTML=n;
  render(1);
  return true;
}
function dec(){
  if(V<=0)return false;
  const old=V,nv=V-1,z=tz(old,0);
  const shrank=nv.toString(2).length<old.toString(2).length&&nv>0;
  let n;
  if(z===0)n="Остання двійкова цифра 1. 1 − 1 = 0, позичати не треба. Решта цифр не змінюється.";
  else{
    n="Остання двійкова цифра 0, від неї 1 не відняти. Позичаємо в найближчої одиниці ліворуч, у розряді "+pw(2,z)+" (позначена крапкою). Вона стає 0, а всі нулі праворуч від неї стають 1.";
    if(shrank)n+=" Ліва цифра стала 0. Нулі на початку числа не пишуть, тому двійковий запис став на одну цифру коротшим.";
  }
  P=V;V=nv;
  column(-1,old,nv,z);
  $("note").innerHTML=n;
  render(-1);
  return true;
}

/* press and hold to repeat; keyboard Enter/Space arrive as click with detail 0 */
function holdable(btn,fn){
  let t1=null,t2=null;
  const stop=()=>{clearTimeout(t1);clearInterval(t2);t1=t2=null};
  btn.addEventListener("pointerdown",e=>{
    if(e.button!==0||btn.disabled)return;
    e.preventDefault();btn.focus();fn();
    t1=setTimeout(()=>{t2=setInterval(()=>{if(!fn())stop()},110)},450);
  });
  ["pointerup","pointerleave","pointercancel","blur"].forEach(ev=>btn.addEventListener(ev,stop));
  btn.addEventListener("click",e=>{if(e.detail===0)fn()});
}
holdable($("up"),inc);
holdable($("dn"),dec);
$("reset").addEventListener("click",()=>{P=V=0;idle();render(0)});
document.addEventListener("keydown",e=>{
  if(e.target.closest&&e.target.closest("input,textarea"))return;
  if(e.key==="ArrowUp"||e.key==="+"||e.key==="="){e.preventDefault();inc()}
  else if(e.key==="ArrowDown"||e.key==="-"){e.preventDefault();dec()}
});

/* hover or tap a digit: light up the same position in its number, expansion and sum */
const board=$("board");
function hl(t){
  board.querySelectorAll(".hl").forEach(x=>x.classList.remove("hl"));
  const el=t&&t.closest&&t.closest("[data-p]");
  if(!el)return;
  board.querySelectorAll('[data-b="'+el.dataset.b+'"][data-p="'+el.dataset.p+'"]').forEach(x=>x.classList.add("hl"));
}
board.addEventListener("pointerover",e=>hl(e.target));
board.addEventListener("pointerleave",()=>hl(null));

let rt=null;
addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(fitAll,80)});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitAll);

function idle(){$("col").innerHTML="";$("note").innerHTML='<span class="hint">Натисніть +1, і тут з\'явиться додавання стовпчиком у двійковій системі: які цифри змінюються і куди йде перенос.</span>'}
idle();render(0);
})();
