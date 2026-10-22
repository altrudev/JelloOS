const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const out={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('services/measuredIrisGeometry.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out.exports});
const {measureIrisGeometry:measure}=out.exports;
function fixture(){
  const f=require('./fixtures/media-pipe-face.cjs').frame();
  for(const [corners,lids,cx,cy] of [ [[33,133],[[160,144],[158,153]],.3,.4], [[362,263],[[385,380],[387,373]],.7,.45] ]){
    corners.forEach((i,j)=>f.result.faceLandmarks[0][i]={x:cx+(j?.05:-.05),y:cy,z:0});
    lids.forEach(([u,l],j)=>{f.result.faceLandmarks[0][u]={x:cx+(j?.02:-.02),y:cy-.01,z:0};f.result.faceLandmarks[0][l]={x:cx+(j?.02:-.02),y:cy+.01,z:0}});
  }
  delete f.quality;return {...f,width:1000,height:500};
}
function safe(r){assert.equal(r.screenGaze,null);assert.equal(r.qualifiedForDwell,false);assert.equal(r.confidence,null)}
test('accepts measured binocular geometry with anatomical eye mapping and pixel aspect correction',()=>{
 const r=measure(fixture(),1020);safe(r);assert.equal(r.accepted,true);
 for(const e of [r.left,r.right]){assert.ok(Math.abs(e.eyeWidthPx-100)<1e-9);assert.ok(Math.abs(e.eyelidOpenness-.1)<1e-9);assert.ok(Math.abs(e.iris.radiusPx-10)<1e-9);assert.ok(e.iris.residualPx<1e-9);assert.equal('confidence' in e,false)}
 assert.ok(Math.abs(r.left.iris.xPx-700)<1e-9);assert.ok(Math.abs(r.right.iris.xPx-300)<1e-9);
});
test('one closed lid is independently measured; model centers and z do not drive fit',()=>{
 const f=fixture(),p=f.result.faceLandmarks[0];for(const [u,l] of [[385,380],[387,373]])p[l]={...p[u]};p[473]={x:.1,y:.1,z:100};
 const r=measure(f,1020);safe(r);assert.equal(r.accepted,true);assert.equal(r.left.eyelidOpenness,0);assert.ok(r.right.eyelidOpenness>0);
});
test('pixel rotation preserves gap ratios and fit',()=>{
 const f=fixture();f.result.faceLandmarks[0]=f.result.faceLandmarks[0].map(p=>({...p,x:1-p.y,y:p.x}));[f.width,f.height]=[f.height,f.width];
 const r=measure(f,1020);assert.equal(r.accepted,true);assert.ok(Math.abs(r.left.eyelidOpenness-.1)<1e-9);assert.ok(Math.abs(r.left.iris.radiusPx-10)<1e-9);
});
test('rejects missing, sparse, nonfinite, out-of-range, stale, future and ambiguous frames',()=>{
 const cases=[null,{},... [{width:0},{height:Infinity},{timestampMs:NaN},{timestampMs:1021},{timestampMs:919},{result:{faceLandmarks:[]}},{result:{faceLandmarks:[[],[]]}}].map(c=>({...fixture(),...c}))];
 for(const value of [null,{x:NaN,y:.4,z:0},{x:2,y:.4,z:0},{x:.3,y:.4,z:NaN}]){const f=fixture();f.result.faceLandmarks[0][470]=value;cases.push(f)}
 const sparse=fixture();delete sparse.result.faceLandmarks[0][20];cases.push(sparse);
 for(const f of cases){const r=measure(f,1020);assert.equal(r.accepted,false);safe(r)}
 assert.equal(measure(fixture(),1100).accepted,true);assert.equal(measure(fixture(),1101).accepted,false);
});
test('rejects degeneracy, inadequate resolution and poor fit, retaining independent other eye',()=>{
 for(const [reason,edit] of [
 ['degenerate-eye-baseline',p=>p[133]={...p[33]}],
 ['degenerate-iris-geometry',p=>p[470]={...p[469]}],
 ['degenerate-iris-geometry',p=>{for(const i of [469,470,471,472])p[i].y=.4}],
 ['eye-too-small',p=>p[133]={...p[33],x:p[33].x+.001}],
 ['iris-too-small',p=>{for(const i of [469,470,471,472]){p[i].x=.3+(p[i].x-.3)*.01;p[i].y=.4+(p[i].y-.4)*.01}}],
 ['poor-iris-fit',p=>p[472]={x:.3,y:.4,z:0}],
 ]){const f=fixture();edit(f.result.faceLandmarks[0]);const r=measure(f,1020);safe(r);assert.equal(r.accepted,false);assert.equal(r.reason,reason);assert.equal(r.left.accepted,true)}
});
