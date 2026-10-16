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
source = source.replace('return { update, resize, dispose,', 'return { audit: { scene, camera, stage, client, therapist, table, laptop, tissue, cupHandle, architecture, garden, worries, gardenPlants, thoughts, knot }, update, resize, dispose,');
globalThis.window = { devicePixelRatio: 1 };
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createRadialGradient: () => ({addColorStop(){}}), fillRect(){} }) }) };
const { createRoom, sampleConversation } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
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

test('thoughts remain anchored to the client during the breathing transition',()=>{
  for(let i=0;i<=80;i++){
    const p=.48+i*.002;room.update(p,3.5);
    const offset=room.audit.thoughts.position.clone().sub(room.audit.client.rig.position);
    assert.ok(Math.hypot(offset.x,offset.z)<.12,`thoughts drift away from the client at ${p}`);
    assert.ok(bounds(room.audit.thoughts).min.y>bounds(room.audit.client.head).max.y+.025,`thoughts cross the head at ${p}`);
  }
});

test('thought strands untangle continuously and restore their shape on reverse scroll',()=>{
  const strands=room.audit.knot.children;
  assert.equal(strands.length,3);
  for(const strand of strands){
    assert.equal(strand.geometry.morphAttributes.position[0].count,strand.geometry.attributes.position.count);
    assert.equal(strand.geometry.morphAttributes.normal[0].count,strand.geometry.attributes.normal.count);
    assert.ok([...strand.geometry.morphAttributes.position[0].array].every(Number.isFinite));
  }
  let previous=[0,0,0];
  for(let i=0;i<=170;i++){
    room.update(.435+i*.001,2);
    const current=strands.map(s=>s.morphTargetInfluences[0]);
    current.forEach((value,j)=>assert.ok(value>=previous[j]&&value-previous[j]<.035,'a thought strand jumps during unravelling'));
    previous=current;
  }
  assert.deepEqual(previous,[1,1,1]);
  room.update(.3,2);
  assert.deepEqual(strands.map(s=>s.morphTargetInfluences[0]),[0,0,0]);
  room.update(.8,2);
  assert.equal(room.audit.thoughts.visible,false,'the thought effect competes with the session clock');
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

test('dialogue gives the client room to speak before the therapist responds',()=>{
  let clientFrames=0,replyFrames=0,nodFrames=0;
  for(let i=0;i<=2000;i++){
    const cue=sampleConversation(i/100);
    assert.ok(cue.clientSpeech*cue.therapistSpeech<1e-8,'both characters speak at once');
    if(cue.clientSpeech>.5)clientFrames++;
    if(cue.therapistSpeech>.5)replyFrames++;
    if(cue.nod>.2&&cue.clientSpeech<.1)nodFrames++;
  }
  assert.ok(clientFrames>600&&replyFrames>200&&nodFrames>100,'the exchange lacks a telling, listening or response beat');
  const before=sampleConversation(20-1e-7),after=sampleConversation(20+1e-7);
  for(const key of Object.keys(before))if(key!=='syllable')assert.ok(Math.abs(before[key]-after[key])<1e-5,`the dialogue loop jumps in ${key}`);
});

test('gesturing hands stay clear of heads and torsos throughout the whole exchange',()=>{
  for(const p of [.28,.36,.445,.49,.65,.77,.85,.99])for(let i=0;i<=200;i++){
    const time=i/10;room.update(p,time);
    for(const actor of [room.audit.client,room.audit.therapist])for(const {palm} of actor.arms){
      palm.geometry.computeBoundingBox();
      const skull=actor.head.children[0];
      const palmToSkull=skull.matrixWorld.clone().invert().multiply(palm.matrixWorld);
      const center=new THREE.Vector3().applyMatrix4(palmToSkull);
      const handRadius=palm.geometry.parameters.radius*palmToSkull.getMaxScaleOnAxis();
      assert.ok(center.length()>skull.geometry.parameters.radius+handRadius,`a hand passes through the head at ${p}/${time}`);
      const shirt=actor.torso.children[0];shirt.geometry.computeBoundingBox();
      const handInShirt=palm.geometry.boundingBox.clone().applyMatrix4(shirt.matrixWorld.clone().invert().multiply(palm.matrixWorld));
      assert.equal(handInShirt.intersectsBox(shirt.geometry.boundingBox),false,`a hand passes through the shirt at ${p}/${time}`);
    }
  }
});

test('expressions blink, speak and soften while keeping the eyes on the face',()=>{
  const apertures=[[],[]],openings=[[],[]];
  for(let i=0;i<=470;i++){
    room.update(.445,i*.05);
    [room.audit.client,room.audit.therapist].forEach((actor,j)=>{
      apertures[j].push(actor.face.mouthOpening.visible?actor.face.mouthOpening.scale.y:0);
      openings[j].push(actor.face.eyes[0].opening.scale.y);
      for(const {opening,pupil} of actor.face.eyes){
        assert.ok(opening.scale.y>=.029&&opening.scale.y<=1);
        assert.ok(Math.abs(pupil.position.x)<=.012&&Math.abs(pupil.position.y)<=.011,'a pupil leaves the eye');
      }
      const weights=actor.face.mouth.morphTargetInfluences;
      assert.ok(weights.every(v=>v>=0&&v<=1)&&weights[0]+weights[1]<=1.00001);
    });
  }
  for(let j=0;j<2;j++){
    assert.ok(Math.min(...openings[j])<.1&&Math.max(...openings[j])>.99,'an actor never blinks');
    assert.ok(Math.min(...apertures[j])===0&&Math.max(...apertures[j])>.23,'speech has no silent or articulated beat');
  }
  room.update(.28,2);const worried=room.audit.client.face.mouth.morphTargetInfluences[0];
  room.update(.64,2);
  assert.ok(worried>.2&&room.audit.client.face.mouth.morphTargetInfluences[1]>.6,'the client never relaxes into a smile');
});

test('characters look at each other and gestures settle without snapping',()=>{
  const point=new THREE.Vector3(),forward=new THREE.Vector3(),target=new THREE.Vector3();
  const p=.445;
  for(const phase of [3,9.5,14]){
    room.update(p,phase-p*6);
    for(const [actor,partner] of [[room.audit.client,room.audit.therapist],[room.audit.therapist,room.audit.client]]){
      actor.head.getWorldPosition(point);partner.head.getWorldPosition(target);
      target.sub(point).setY(0).normalize();
      forward.set(0,0,1).transformDirection(actor.head.matrixWorld).setY(0).normalize();
      assert.ok(forward.dot(target)>.86,'an actor is staring past their partner');
    }
  }
  let previous;
  for(let i=0;i<=1200;i++){
    room.update(p,i/60);
    const current=[];
    for(const actor of [room.audit.client,room.audit.therapist])for(const joint of [actor.head,actor.torso,...actor.arms.flatMap(a=>[a.shoulder,a.elbow,a.wrist])])current.push(joint.rotation.x,joint.rotation.y,joint.rotation.z);
    if(previous)current.forEach((v,j)=>assert.ok(Math.abs(v-previous[j])<.045,'a conversational gesture snaps between frames'));
    previous=current;
  }
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
