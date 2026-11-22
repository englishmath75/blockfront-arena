import {Frustum,Matrix4,Sphere,Vector3,Ray} from 'three';
export function playerVisibility(camera,structure,software){
  const frustum=new Frustum(),matrix=new Matrix4(),bounds=new Sphere(new Vector3(),1.45);
  const target=new Vector3(),ray=new Ray(),cached=new Map();
  return {
    prepare(){camera.updateMatrixWorld();camera.updateProjectionMatrix();frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse))},
    visible(p,loc,t,revealed){
      bounds.center.set(loc.x,loc.y+.9,loc.z);
      if(!frustum.intersectsSphere(bounds))return false;
      if(!software || revealed || camera.position.distanceToSquared(bounds.center)<49 || !structure.intersect)return true;
      const prior=cached.get(p.id);
      if(prior && t-prior.t<(prior.visible?.1:.07) && prior.at.distanceToSquared(camera.position)<.09 && prior.target.distanceToSquared(bounds.center)<.09)return prior.visible;
      ray.origin.copy(camera.position);
      const lateral=Math.atan2(loc.z-ray.origin.z,loc.x-ray.origin.x);
      let visible=false;
      for(const [side,dy] of [[0,.75],[-.39,-.06],[.39,-.15],[0,-.75]]){
        target.copy(bounds.center);target.y+=dy;target.x-=Math.sin(lateral)*side;target.z+=Math.cos(lateral)*side;
        ray.direction.subVectors(target,ray.origin);const len=ray.direction.length();ray.direction.multiplyScalar(1/len);
        if(structure.intersect(ray,len)>=len-.09){visible=true;break}
      }
      const item=prior??{at:new Vector3(),target:new Vector3()};item.at.copy(camera.position);item.target.copy(bounds.center);
      item.t=t;item.visible=visible;cached.set(p.id,item);return visible;
    }
  };
}
