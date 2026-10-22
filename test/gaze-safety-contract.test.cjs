const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const files=['index.html','gaze-diagnostics.html','contexts/GazeContext.tsx'].map(p=>[p,fs.readFileSync(p,'utf8')]);
test('no persistent gaze calibration or adaptive self-training in JelloOS paths',()=>{for(const [path,src] of files){assert.doesNotMatch(src,/saveDataAcrossSessions\(true\)/,path);assert.doesNotMatch(src,/\.enableAdaptiveRecalibration\(\)/,path)}});
test('unified FaceMesh tracker and explicit pinned assets',()=>{for(const [path,src] of files){assert.match(src,/setTracker\('TFFaceMesh'\)/,path);assert.match(src,/faceMeshSolutionPath/,path);assert.doesNotMatch(src,/setTracker\('clmtrackr'\)/,path)}});
test('readme does not claim upstream GPL-to-LGPL valuation exception',()=>{assert.doesNotMatch(fs.readFileSync('README.md','utf8'),/you may use both under LGPLv3/i)});

test('eye patch darkness is not represented as actual pupil tracking',()=>{const src=fs.readFileSync('gaze-diagnostics.html','utf8');assert.match(src,/Dark pixel fraction \(not pupil detection\)/);assert.match(src,/darkPixelRatio/);assert.doesNotMatch(src,/Pupil detect estimate/);});
