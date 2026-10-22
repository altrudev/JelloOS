import {measureIris,type Landmark} from './lib/irisGeometry';
import {FaceLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
const $=(id:string)=>document.getElementById(id)!;
const video=$('camera') as HTMLVideoElement,canvas=$('overlay') as HTMLCanvasElement,ctx=canvas.getContext('2d')!;
let stream:MediaStream|null=null,detector:FaceLandmarker|null=null,raf=0,lastProcessed=0,frames=0,invalid=0,busy=false;
function label(id:string,s:string){$(id).textContent=s;}
function reset(){for(const id of ['left-h','right-h','left-center','right-center','difference'])label(id,'—');label('available','unavailable');}
function draw(m:ReturnType<typeof measureIris>,landmarks:Landmark[]){
 const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;
 const rect=video.getBoundingClientRect(),stage=$('stage').getBoundingClientRect();
 const scale=Math.min(rect.width/w,rect.height/h),dw=w*scale,dh=h*scale;
 const ox=(rect.width-dw)/2,oy=(rect.height-dh)/2;
 canvas.width=Math.round(stage.width*devicePixelRatio);canvas.height=Math.round(stage.height*devicePixelRatio);
 ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,stage.width,stage.height);
 if(!m.available)return;
 // Video preview is mirrored; overlay X must use the same reflection.
 for(const eye of [m.left,m.right]){const x=ox+dw*(1-eye.cx/w),y=oy+dh*eye.cy/h;
 ctx.strokeStyle='#4affb6';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(3,eye.radiusPx*scale),0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#ffbf4f';ctx.beginPath();ctx.arc(x,y,3.5,0,Math.PI*2);ctx.fill();}
}
async function frame(now:number){
 if(!stream)return;
 raf=requestAnimationFrame(frame);
 if(busy||now-lastProcessed<90||video.readyState<2||!detector)return;
 lastProcessed=now;busy=true;
 try{
 const result=detector.detectForVideo(video,now),points=result.faceLandmarks[0];
 if(!points){invalid++;reset();return;}
 const pixels=points.map(p=>({x:p.x*video.videoWidth,y:p.y*video.videoHeight,z:p.z}));
 const m=measureIris(pixels);if(!m.available){invalid++;reset();return;}
 frames++;label('available','both eyes');
 label('left-h',m.left.horizontal.toFixed(3));label('right-h',m.right.horizontal.toFixed(3));
 label('left-center',m.left.cx.toFixed(1)+', '+m.left.cy.toFixed(1)+' px');
 label('right-center',m.right.cx.toFixed(1)+', '+m.right.cy.toFixed(1)+' px');
 label('difference',Math.abs(m.left.horizontal-m.right.horizontal).toFixed(3));
 draw(m,pixels);
 }catch(e){invalid++;reset();label('status','Detection error: '+String(e).slice(0,110));}
 finally{label('frames',String(frames));label('invalid',String(invalid));busy=false;}
}
async function stop(){
 cancelAnimationFrame(raf);raf=0;
 if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
 video.srcObject=null;detector?.close();detector=null;ctx.clearRect(0,0,canvas.width,canvas.height);
 reset();label('status','Camera off');($('start') as HTMLButtonElement).disabled=false;($('stop') as HTMLButtonElement).disabled=true;
}
$('start').addEventListener('click',async()=>{
 const button=$('start') as HTMLButtonElement;button.disabled=true;label('status','Loading on-device detector…');
 try{
 const files=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm');
 detector=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numFaces:1});
 stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:1280},height:{ideal:720},facingMode:'user'}});
 video.srcObject=stream;await video.play();
 ($('stop') as HTMLButtonElement).disabled=false;label('status','Measuring iris contours. Keep the mouse still.');
 raf=requestAnimationFrame(frame);
 }catch(e){label('status','Camera/model error: '+String(e).slice(0,150));await stop();}
});
$('stop').addEventListener('click',stop);
window.addEventListener('pagehide',()=>{void stop()});
