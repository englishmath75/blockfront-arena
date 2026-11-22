import {Matrix4} from 'three';

// The depth grid contains only cells fully covered by an opaque face from
// the map. Missing coverage, transparent tiles and near-plane intersections
// leave the scenery visible. Animated gates are excluded from this grid.
export function sceneryVisibility(root, faces) {
  const width=64,height=36,depth=new Float32Array(width*height);
  const clip=new Matrix4(),previous=new Matrix4();
  const sx=new Float64Array(4),sy=new Float64Array(4);
  const edgeX=new Float64Array(4),edgeY=new Float64Array(4),edgeC=new Float64Array(4);
  let m;
  let eye;
  function cover(polygon) {
    const n=polygon.length/3;
    let left=width,right=0,top=height,bottom=0,far=0;
    for(let i=0;i<n;i++){
      const x=polygon[i*3],y=polygon[i*3+1],z=polygon[i*3+2];
      if((x-eye.x)**2+(y-eye.y)**2+(z-eye.z)**2>12*12)return;
      const w=m[3]*x+m[7]*y+m[11]*z+m[15];
      if(w<.08 || w>85)return;
      far=Math.max(far,w);
      sx[i]=(1+(m[0]*x+m[4]*y+m[8]*z+m[12])/w)*width*.5;
      sy[i]=(1+(m[1]*x+m[5]*y+m[9]*z+m[13])/w)*height*.5;
      left=Math.min(left,sx[i]);right=Math.max(right,sx[i]);top=Math.min(top,sy[i]);bottom=Math.max(bottom,sy[i]);
    }
    left=Math.max(0,Math.ceil(left));right=Math.min(width,Math.floor(right));
    top=Math.max(0,Math.ceil(top));bottom=Math.min(height,Math.floor(bottom));
    if(left>=right || top>=bottom)return;
    const sign=Math.sign((sx[1]-sx[0])*(sy[2]-sy[0])-(sy[1]-sy[0])*(sx[2]-sx[0]));
    if(!sign)return;
    for(let i=0;i<n;i++){
      const j=(i+1)%n,dx=(sx[j]-sx[i])*sign,dy=(sy[j]-sy[i])*sign;
      edgeX[i]=-dy;edgeY[i]=dx;
      // Least signed distance among the four corners of this grid cell.
      edgeC[i]=dy*sx[i]-dx*sy[i]+Math.min(0,-dy)+Math.min(0,dx);
    }
    for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
      const idx=y*width+x;
      if(depth[idx]<=far+.04)continue;
      let i=0;
      for(;i<n;i++)if(edgeX[i]*x+edgeY[i]*y+edgeC[i]<.01)break;
      if(i===n)depth[idx]=far+.04;
    }
  }
  const groups=root.children.map(mesh=>{
    mesh.geometry.computeBoundingBox();
    return {mesh,box:mesh.geometry.boundingBox};
  });
  function visible(box) {
    let minX=width,minY=height,maxX=0,maxY=0,near=Infinity;
    for(let i=0;i<8;i++){
      const x=i&1?box.max.x:box.min.x,y=i&2?box.max.y:box.min.y,z=i&4?box.max.z:box.min.z;
      const w=m[3]*x+m[7]*y+m[11]*z+m[15];
      if(w<.08)return true;
      near=Math.min(near,w);
      const px=(1+(m[0]*x+m[4]*y+m[8]*z+m[12])/w)*width*.5;
      const py=(1+(m[1]*x+m[5]*y+m[9]*z+m[13])/w)*height*.5;
      minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
    }
    const left=Math.max(0,Math.floor(minX)),right=Math.min(width-1,Math.floor(maxX));
    const top=Math.max(0,Math.floor(minY)),bottom=Math.min(height-1,Math.floor(maxY));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(depth[y*width+x]>=near)return true;
    return false;
  }
  return camera=>{
    clip.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(root.matrixWorld);
    if(previous.equals(clip))return;
    previous.copy(clip);m=clip.elements;eye=camera.position;depth.fill(Infinity);
    for(const face of faces)cover(face);
    for(const {mesh,box} of groups)mesh.visible=visible(box);
  };
}
