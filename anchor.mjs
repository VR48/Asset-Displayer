const anchors=new WeakMap();
export function previewAnchor(img,geometry){
 const explicit=geometry.anchor??geometry.native_anchor??geometry.fixed_native_anchor;if(explicit)return explicit;
 if(anchors.has(geometry))return anchors.get(geometry);
 const canvas=document.createElement('canvas'),w=canvas.width=160,h=canvas.height=Math.max(1,Math.round(img.height*160/img.width)),c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,w,h);
 const pixels=c.getImageData(0,0,w,h).data,corners=[0,w-1,(h-1)*w,h*w-1].map(i=>Array.from(pixels.slice(i*4,i*4+4))),transparent=corners.some(p=>p[3]<128),matte=[0,1,2].map(k=>corners.reduce((n,p)=>n+p[k],0)/4);
 let left=w,right=-1,bottom=-1;const points=[];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(pixels[i+3]<32)continue;if(!transparent&&Math.hypot(...matte.map((v,k)=>pixels[i+k]-v))<85)continue;points.push([x,y]);left=Math.min(left,x);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 const feet=points.filter(p=>p[1]>=bottom-5),x=feet.length?feet.reduce((n,p)=>n+p[0],0)/feet.length:(left+right)/2;
 const a=bottom<0?[img.width/2,img.height*.94]:[x*img.width/w,Math.min(img.height-4,(bottom+1)*img.height/h)];anchors.set(geometry,a);return a;
}
export function drawAnchor(c,point,sample=c,background='checker'){
 const x=Math.max(0,Math.min(sample.canvas.width-1,Math.round(point[0]*sample.canvas.width/c.canvas.width))),y=Math.max(0,Math.min(sample.canvas.height-1,Math.round(point[1]*sample.canvas.height/c.canvas.height))),pixel=sample.getImageData(x,y,1,1).data;
 const fallback=background==='light'?[221,221,221]:[50,58,70],rgb=[0,1,2].map(k=>(pixel[k]*pixel[3]+fallback[k]*(255-pixel[3]))/255),linear=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}),light=.2126*linear[0]+.7152*linear[1]+.0722*linear[2],ink=light>.179?'#000000':'#ffffff',outline=light>.179?'#ffffff':'#000000';
 c.save();c.setTransform(1,0,0,1,0,0);c.lineCap='round';c.beginPath();c.moveTo(point[0]-18,point[1]);c.lineTo(point[0]+18,point[1]);c.moveTo(point[0],point[1]-18);c.lineTo(point[0],point[1]+18);c.strokeStyle=outline;c.lineWidth=6;c.stroke();c.strokeStyle=ink;c.lineWidth=3;c.stroke();c.restore();
}
