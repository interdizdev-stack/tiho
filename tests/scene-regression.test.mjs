import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import * as THREE from 'three';

// Exercise the real geometry and pose code without requiring a GPU in Node.
const project = resolve(import.meta.dirname, '..');
let source = await readFile(resolve(project, 'src/room.js'), 'utf8');
source = source.replace("'three'", JSON.stringify(pathToFileURL(resolve(project, 'node_modules/three/build/three.module.js')).href));
source = source.replace("'three/addons/geometries/RoundedBoxGeometry.js'", JSON.stringify(pathToFileURL(resolve(project, 'node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js')).href));
source = source.replace('new THREE.WebGLRenderer(', 'new TestRenderer(');
source = `class TestRenderer { shadowMap = {}; setPixelRatio(){} setClearColor(){} setSize(){} dispose(){} render(scene,camera){ scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); } }\n${source}`;
source = source.replace('return { update, resize, dispose,', 'return { audit: { scene, camera, stage, client, therapist, table, laptop, tissue, cupHandle, architecture, garden, worries, gardenPlants }, update, resize, dispose,');
globalThis.window = { devicePixelRatio: 1 };
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({addColorStop(){}}), fillRect(){} }) }) };
const { createRoom } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const mainSource = await readFile(resolve(project,'src/main.js'),'utf8');
const progressCode = mainSource.match(/function storyProgress\([^]*?\n\}/)?.[0];
assert.ok(progressCode,'the chapter timing function must be testable independently of page height');
const storyProgress = Function(`return (${progressCode});`)();
const room = createRoom({ clientWidth: 800, clientHeight: 620 });
const bounds = object => new THREE.Box3().setFromObject(object);
const soleBounds = actor => actor.legs.map(({knee}) => bounds(knee.children.at(-1)));
const feetMin = actor => Math.min(...soleBounds(actor).map(box => box.min.y));
const feetMax = actor => Math.max(...soleBounds(actor).map(box => box.min.y));
const ground = [];
room.audit.scene.traverse(object => {
  const p = object.geometry?.parameters;
  if (p?.width > 3 && p?.height < .24 && p?.depth > 3) ground.push(object);
});
function supportHeight(actor) {
  const foot = soleBounds(actor).sort((a,b)=>a.min.y-b.min.y)[0];
  const center = foot.getCenter(new THREE.Vector3());
  const ray = new THREE.Raycaster(new THREE.Vector3(center.x, 4, center.z), new THREE.Vector3(0,-1,0));
  return ray.intersectObjects(ground, false)[0]?.point.y;
}

test('both actors keep a foot on the floor throughout sitting, walking and standing', () => {
  for (let i=0;i<=500;i++) {
    const p=i/500; room.update(p, 2.75);
    for (const [name, actor] of [['client',room.audit.client],['therapist',room.audit.therapist]]) {
      const floor = supportHeight(actor);
      assert.ok(Number.isFinite(floor), `${name} has no supporting floor at ${p}`);
      const gap = feetMin(actor)-floor;
      assert.ok(gap >= -.006 && gap <= .025, `${name} foot/floor gap ${gap.toFixed(4)} at progress ${p}`);
    }
  }
});

test('laptop base does not intersect the cup or the tissue box', () => {
  room.update(2/3,0);
  const base=bounds(room.audit.laptop.children[0]);
  const cup=room.audit.cupHandle.parent===room.audit.table ? room.audit.table.children[4] : room.audit.cupHandle.parent;
  const tissueBox=room.audit.tissue.parent===room.audit.table ? room.audit.table.children[7] : room.audit.tissue.parent;
  assert.equal(base.intersectsBox(bounds(cup)),false,'the cup penetrates the laptop keyboard/base');
  assert.equal(base.intersectsBox(bounds(tissueBox)),false,'the tissues penetrate the laptop keyboard/base');
});

test('legs clear the armrests while approaching and rising from each chair',()=>{
  const point=new THREE.Vector3();
  const closest=new THREE.Vector3();
  for(let i=0;i<=500;i++){
    const p=i/500;room.update(p,2.75);
    for(const [name,actor,x,z] of [['client',room.audit.client,-1.2,.54],['therapist',room.audit.therapist,1.29,.32]]){
      const chair=room.audit.stage.children.find(object=>object.isGroup&&Math.abs(object.position.x-x)<.0001&&Math.abs(object.position.z-z)<.0001);
      const inverse=chair.matrixWorld.clone().invert();
      for(const side of [-1,1]){
        const arm=new THREE.Box3(new THREE.Vector3(side*.48-.1,.36,-.4),new THREE.Vector3(side*.48+.1,.74,.46));
        for(const {hip,knee} of actor.legs)for(const [joint,length] of [[hip,.36],[knee,.55]])for(let sample=1;sample<=6;sample++){
          point.set(0,-length*sample/6,0).applyMatrix4(joint.matrixWorld).applyMatrix4(inverse);
          arm.clampPoint(point,closest);
          assert.ok(point.distanceTo(closest)>=.045,`${name} leg penetrates an armrest at progress ${p}`);
        }
      }
    }
  }
});

test('floating emotion symbols stay above the client face',()=>{
  for(const p of [.1,.13,.17,.2,.25]){
    room.update(p,2.75);
    const symbolBottom=bounds(room.audit.worries).min.y;
    const headTop=bounds(room.audit.client.head).max.y;
    assert.ok(symbolBottom>headTop+.025,`emotion symbols intersect the face at ${p}: ${symbolBottom.toFixed(3)} vs head ${headTop.toFixed(3)}`);
  }
});

test('garden plants do not move through chairs while the courtyard appears',()=>{
  const chairs=room.audit.stage.children.filter(object=>object.isGroup&&Math.abs(object.position.y-.09)<.0001&&[1.29,-1.2].some(x=>Math.abs(object.position.x-x)<.0001));
  for(let i=0;i<=80;i++){
    const p=.911+i*.001;room.update(p,0);
    if(!room.audit.garden.visible)continue;
    for(const plant of room.audit.gardenPlants)for(const chair of chairs)for(const part of chair.children.slice(4)){
      assert.equal(bounds(plant).intersectsBox(bounds(part)),false,`a growing garden plant intersects an armchair at ${p.toFixed(3)}`);
    }
  }
});

test('all visible scenery stays inside the camera on portrait, desktop and short screens', () => {
  const point = new THREE.Vector3();
  for (const [width,height] of [[400,680],[780,620],[340,200],[1000,420]]) {
    room.resize(width,height);
    for (let i=0;i<=40;i++) {
      const p=i/40; room.update(p,0,{x:1,y:-1});
      const camera=room.audit.camera;
      room.audit.stage.traverseVisible(object=>{
        if(!object.geometry)return;
        object.geometry.computeBoundingBox();
        const box=object.geometry.boundingBox;
        for (const x of [box.min.x,box.max.x]) for (const y of [box.min.y,box.max.y]) for (const z of [box.min.z,box.max.z]) {
          point.set(x,y,z).applyMatrix4(object.matrixWorld).project(camera);
          assert.ok(Math.abs(point.x)<=.985 && Math.abs(point.y)<=.985,`scenery cropped at progress ${p}, ${width}x${height}: ${point.x.toFixed(2)},${point.y.toFixed(2)}`);
        }
      });
    }
  }
});

test('a pose is identical when revisited after scrubbing in either direction', () => {
  const snapshot = () => {
    const result=[];
    room.audit.stage.traverse(object=>result.push(...object.matrixWorld.elements));
    return result;
  };
  for (const p of [0,.18,.235,.44,.55,.665,.78,.86,.925,1]) {
    room.update(p,3);const expected=snapshot();
    room.update(1-p,9);room.update(p,3);
    assert.deepEqual(snapshot(),expected,`pose retains stale transforms at ${p}`);
  }
});

test('changing the motion preference preserves the current story pose',()=>{
  room.update(.665,0);const previous=room.audit.client.rig.position.clone();
  room.setReducedMotion(true);room.update(.665,0);
  assert.ok(room.audit.client.rig.position.distanceTo(previous)<.01);
  room.setReducedMotion(false);
});

test('expanding questions does not rewind the current scene or change earlier chapter timing',()=>{
  const before=storyProgress(7750,8,7200,900,8550,10);
  const after=storyProgress(7750,8,7200,900,9250,10);
  assert.equal(after,before);
  assert.equal(storyProgress(7650,8,7200,900,9250,10),8/9);
  assert.equal(storyProgress(9250,9,8900,900,9250,10),1);
});

test('each chapter boundary is continuous, including extra reading space in long chapters',()=>{
  for(let index=0;index<9;index++){
    const start=index*900;
    const end=start+900;
    assert.ok(Math.abs(storyProgress(end,index,start,900,10000,10)-storyProgress(end,index+1,end,900,10000,10))<1e-10);
  }
  assert.equal(storyProgress(8400,8,7200,900,9900,10),storyProgress(9000,9,9000,900,9900,10));
});
