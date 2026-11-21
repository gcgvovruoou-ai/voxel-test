export class Player {
 constructor(camera){this.camera=camera;this.x=0;this.y=8;this.z=0;this.vy=0;this.yaw=0;this.pitch=0;this.grounded=false;this.radius=.3;this.height=1.8;this.speed=4.4;this.jumpSpeed=8.2;this.creative=false;}
 solid(world,x,y,z){return !!world.get(Math.round(x),Math.round(y),Math.round(z));}
 collides(world,x,y,z){const r=this.radius;for(const px of [x-r,x+r])for(const pz of [z-r,z+r])for(let py=y;py<y+this.height;py+=.45)if(this.solid(world,px,py,pz))return true;return false;}
 update(dt,move,world,jump){const step=Math.min(dt,.04),fx=-Math.sin(this.yaw),fz=-Math.cos(this.yaw),rx=Math.cos(this.yaw),rz=-Math.sin(this.yaw);let dx=(fx*-move.y+rx*move.x)*this.speed*step,dz=(fz*-move.y+rz*move.x)*this.speed*step;const len=Math.hypot(dx,dz);if(len>this.speed*step){dx*=this.speed*step/len;dz*=this.speed*step/len;}
  if(this.creative){this.x+=dx;this.z+=dz;if(jump)this.y+=this.speed*step;this.camera.position.set(this.x,this.y+1.62,this.z);return;}
  if(!this.collides(world,this.x+dx,this.y,this.z))this.x+=dx;if(!this.collides(world,this.x,this.y,this.z+dz))this.z+=dz;
  if(jump&&this.grounded){this.vy=this.jumpSpeed;this.grounded=false;}this.vy-=22*step;let ny=this.y+this.vy*step;if(this.collides(world,this.x,ny,this.z)){if(this.vy<0)this.grounded=true;this.vy=0;}else{this.y=ny;this.grounded=false;}
  if(this.y< -12){this.x=0;this.z=0;this.y=8;this.vy=0;}this.camera.position.set(this.x,this.y+1.62,this.z);this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");
 }
}