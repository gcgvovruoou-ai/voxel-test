import {BLOCKS,blockAt} from "./blocks.js";
const SIZE=16, HEIGHT=20;
export class World {
  constructor(scene){this.scene=scene;this.blocks=new Map();this.chunks=new Map();this.materials={};for(const [name,data] of Object.entries(BLOCKS))this.materials[name]=new THREE.MeshLambertMaterial({color:data.color});this.geometry=new THREE.BoxGeometry(1,1,1);this.seed=173;}
  height(x,z){return Math.floor(3+Math.sin(x*.12)*1.3+Math.cos(z*.15)*1.1+Math.sin((x+z)*.07));}
  get(x,y,z){return this.blocks.get(blockAt(x,y,z))||null;}
  set(x,y,z,type){if(y< -8||y>HEIGHT)return;const k=blockAt(x,y,z);if(type)this.blocks.set(k,{x,y,z,type});else this.blocks.delete(k);this.dirtyAt(x,z);}
  generateChunk(cx,cz){const id=cx+","+cz;if(this.chunks.has(id))return;const group=new THREE.Group();group.userData={cx,cz};this.scene.add(group);this.chunks.set(id,group);
    for(let x=cx*SIZE;x<(cx+1)*SIZE;x++)for(let z=cz*SIZE;z<(cz+1)*SIZE;z++){const h=this.height(x,z);for(let y=-3;y<=h;y++){const type=y===h?"grass":y>h-3?"dirt":"stone";this.blocks.set(blockAt(x,y,z),{x,y,z,type});}
      if(Math.abs(x*13+z*7)%71===0&&Math.abs(x)+Math.abs(z)>8)this.makeTree(x,h+1,z);
    }this.rebuildChunk(cx,cz);}
  makeTree(x,y,z){for(let n=0;n<4;n++)this.blocks.set(blockAt(x,y+n,z),{x,y:y+n,z,type:"wood"});for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)for(let dy=2;dy<=4;dy++)if(Math.abs(dx)+Math.abs(dz)+(dy===4?1:0)<5){const a=x+dx,b=y+dy,c=z+dz;this.blocks.set(blockAt(a,b,c),{x:a,y:b,z:c,type:"leaves"});}}
  ensureAround(x,z,r=2){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++)this.generateChunk(cx+a,cz+b);for(const [id,g] of this.chunks){const [a,b]=id.split(",").map(Number);if(Math.abs(a-cx)>r+1||Math.abs(b-cz)>r+1){this.scene.remove(g);g.traverse(o=>{if(o.geometry&&o.geometry!==this.geometry)o.geometry.dispose();});this.chunks.delete(id);}}}
  dirtyAt(x,z){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);this.rebuildChunk(cx,cz);if(x-cx*SIZE<1)this.rebuildChunk(cx-1,cz);if(x-cx*SIZE>SIZE-2)this.rebuildChunk(cx+1,cz);if(z-cz*SIZE<1)this.rebuildChunk(cx,cz-1);if(z-cz*SIZE>SIZE-2)this.rebuildChunk(cx,cz+1);}
  rebuildChunk(cx,cz){const id=cx+","+cz,g=this.chunks.get(id);if(!g)return;while(g.children.length){const m=g.children[g.children.length-1];g.remove(m);if(m.geometry!==this.geometry)m.geometry.dispose();}
    const byType={};for(const b of this.blocks.values()){if(Math.floor(b.x/SIZE)!==cx||Math.floor(b.z/SIZE)!==cz)continue;const dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];if(dirs.some(d=>!this.get(b.x+d[0],b.y+d[1],b.z+d[2]))) (byType[b.type]??=[]).push(b);}
    const dummy=new THREE.Object3D();for(const [type,list] of Object.entries(byType)){const mesh=new THREE.InstancedMesh(this.geometry,this.materials[type],list.length);mesh.userData.blocks=list;list.forEach((b,i)=>{dummy.position.set(b.x,b.y,b.z);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.userData.chunk=id;g.add(mesh);}
  }
  raycast(raycaster){const hits=[];for(const g of this.chunks.values())for(const m of g.children){const h=raycaster.intersectObject(m,false);if(h.length)hits.push(h[0]);}hits.sort((a,b)=>a.distance-b.distance);if(!hits.length)return null;const hit=hits[0],b=hit.object.userData.blocks[hit.instanceId];return {block:b,normal:hit.face.normal.clone(),point:hit.point,distance:hit.distance};}
  breakBlock(b){if(!b)return;this.set(b.x,b.y,b.z,null);}
  placeBlock(hit,type){if(!hit)return;const n=hit.normal,p=hit.block;const x=p.x+Math.round(n.x),y=p.y+Math.round(n.y),z=p.z+Math.round(n.z);if(!this.get(x,y,z))this.set(x,y,z,type);}
}