(()=>{
'use strict';
const days=JSON.parse(document.getElementById('itinerary-map-data').textContent);
let enginePromise=null,map=null,activeDay=0,markers=[],pending=0,forcedUntil=0,errorState=false,loadTimer;
const shared=document.createElement('div');shared.id='shared-live-map';
function status(day,text,error=false){const el=document.getElementById('map-status-'+day);if(el){el.textContent=text;el.classList.toggle('map-error',error);}}
function ensureEngine(){
 if(window.maplibregl)return Promise.resolve();
 if(enginePromise)return enginePromise;
 enginePromise=new Promise((resolve,reject)=>{
  if(!document.getElementById('maplibre-css')){const l=document.createElement('link');l.id='maplibre-css';l.rel='stylesheet';l.href='assets/nordic-v4/maplibre-gl.css';document.head.append(l);}
  const sc=document.createElement('script');sc.src='assets/nordic-v4/maplibre-gl.js';sc.async=true;
  const timer=setTimeout(()=>{enginePromise=null;sc.remove();reject(Error('map engine timeout'));},20000);
  sc.onload=()=>{clearTimeout(timer);resolve();};sc.onerror=()=>{clearTimeout(timer);enginePromise=null;sc.remove();reject(Error('map engine unavailable'));};document.head.append(sc);
 });return enginePromise;
}
function popupFor(pt){const wrap=document.createElement('div'),title=document.createElement('strong'),a=document.createElement('a');title.textContent=pt.name;a.textContent='在 Google Maps 開啟 ↗';a.href=pt.url;a.target='_blank';a.rel='noopener';wrap.append(title,document.createElement('br'),a);return wrap;}
function setMarkers(day){markers.forEach(m=>m.remove());markers=[];days[day-1].forEach((pt,i)=>{
 const el=document.createElement('button');el.type='button';el.className='pin-button';el.textContent=String(i+1);el.title=pt.name;el.setAttribute('aria-label',(i+1)+'. '+pt.name);
 const marker=new maplibregl.Marker({element:el}).setLngLat([pt.lng,pt.lat]).setPopup(new maplibregl.Popup({offset:20}).setDOMContent(popupFor(pt))).addTo(map);
 el.addEventListener('click',()=>highlight(day,i));markers.push(marker);
 });}
function highlight(day,index){document.querySelectorAll('#day'+day+' .map-places li').forEach((el,i)=>el.classList.toggle('active',i===index));}
function fit(day,all=false){const pts=day===11&&!all?days[day-1].slice(1):days[day-1];if(pts.length===1){map.jumpTo({center:[pts[0].lng,pts[0].lat],zoom:12});return;}const b=new maplibregl.LngLatBounds();pts.forEach(p=>b.extend([p.lng,p.lat]));map.fitBounds(b,{padding:45,maxZoom:15,duration:0});}
function focus(day,index){const pt=days[day-1][index];map.jumpTo({center:[pt.lng,pt.lat],zoom:16});markers.forEach(m=>{const p=m.getPopup();if(p.isOpen())p.remove();});markers[index].togglePopup();highlight(day,index);}
async function mount(day,index=null,all=false,manual=false){
 const ticket=++pending;
 if(manual)forcedUntil=Date.now()+1800;
 status(day,'正在載入詳細街道地圖…');
 try{
  await ensureEngine();if(ticket!==pending)return;
  if(errorState&&manual&&map){map.remove();map=null;markers=[];errorState=false;shared.replaceChildren();}
  if(activeDay&&activeDay!==day){const old=document.getElementById('map-host-'+activeDay);old.querySelector('.map-placeholder').hidden=false;status(activeDay,'捲回此處或按「開啟／重試地圖」即可再次查看。');}
  const host=document.getElementById('map-host-'+day);host.querySelector('.map-placeholder').hidden=true;host.append(shared);activeDay=day;
  if(!map){
   if(maplibregl.setWorkerCount)maplibregl.setWorkerCount(1);
   map=new maplibregl.Map({container:shared,style:'https://tiles.openfreemap.org/styles/liberty',center:[days[day-1][0].lng,days[day-1][0].lat],zoom:10,renderWorldCopies:false,attributionControl:true,cooperativeGestures:true,fadeDuration:0,pixelRatio:Math.min(window.devicePixelRatio||1,1.5)});
   map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');map.addControl(new maplibregl.ScaleControl({maxWidth:90}),'bottom-left');map.dragRotate.disable();map.touchZoomRotate.disableRotation();
   map.on('load',()=>{errorState=false;clearTimeout(loadTimer);status(activeDay,'可縮放查看街道與周邊地標；手機請用兩指移動地圖。點 Pin 查看景點。');});
   map.on('error',()=>{errorState=true;status(activeDay,'底圖暫時無法完整載入。可按「開啟／重試地圖」，或使用右側 Google Maps；行程內容不受影響。',true);});
   map.on('idle',()=>{if(map&&map.isStyleLoaded()&&map.areTilesLoaded()){errorState=false;clearTimeout(loadTimer);status(activeDay,'可縮放查看街道與周邊地標；手機請用兩指移動地圖。點 Pin 查看景點。');}});
  }
  map.resize();setMarkers(day);fit(day,all);if(index!==null)focus(day,index);
  clearTimeout(loadTimer);loadTimer=setTimeout(()=>{if(map&&!(map.isStyleLoaded()&&map.areTilesLoaded()))status(activeDay,'地圖連線較慢，可先使用右側 Google Maps；稍後可重試。',true);},20000);
  if(map.isStyleLoaded()&&map.areTilesLoaded())status(day,'可縮放查看街道與周邊地標；手機請用兩指移動地圖。');
 }catch(e){status(day,'此裝置或連線目前無法啟用互動地圖，請使用右側 Google Maps，或稍後重試。',true);const host=document.getElementById('map-host-'+day);host.querySelector('.map-placeholder').hidden=false;}
}
document.querySelectorAll('.map-open').forEach(b=>b.addEventListener('click',()=>mount(Number(b.dataset.day),null,false,true)));
document.querySelectorAll('.map-reset').forEach(b=>b.addEventListener('click',()=>mount(Number(b.dataset.day),null,true,true)));
document.querySelectorAll('.map-focus').forEach(b=>b.addEventListener('click',()=>{const d=Number(b.dataset.day);document.getElementById('map-host-'+d).scrollIntoView({behavior:'smooth',block:'center'});mount(d,Number(b.dataset.point),false,true);}));
if('IntersectionObserver' in window){const observer=new IntersectionObserver(entries=>{if(Date.now()<forcedUntil)return;const entry=entries.filter(e=>e.isIntersecting&&e.intersectionRatio>=.35).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(entry){const d=Number(entry.target.dataset.day);if(d!==activeDay)mount(d);}}, {threshold:[.35,.6]});document.querySelectorAll('.live-map-host').forEach(el=>observer.observe(el));}
window.addEventListener('resize',()=>{if(map)map.resize();});
})();
