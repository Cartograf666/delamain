// Reuse the accepted fish art. Its black backing contributes zero light;
// brightness-derived alpha leaves the city visible through the projected body.
export async function createPlazaHologram(gl,{program,transform,camera,uniform,center,base}) {
  const shader=program(`#version 300 es
precision highp float;layout(location=0)in vec2 corner;out vec2 uv;${transform}
uniform vec2 center;void main(){uv=corner*.5+.5;vec2 p=center+corner*vec2(57.,57.);gl_Position=project(vec3(p,-.9));}`,`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D art;uniform float time;uniform float emission;out vec4 outColor;
void main(){vec3 c=texture(art,uv).rgb;float light=max(c.r,max(c.g,c.b));
float alpha=smoothstep(.035,.42,light)*.64;
float scan=.88+.12*sin(uv.y*420.-time*.65);
outColor=vec4(c*scan*(emission>0.?.55:1.),alpha);}`);
  const image=new Image();image.src=new URL('../holo.png',base);await image.decode();
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  return {draw(time,emission){
    const t=reduced.matches?0:time;
    const drift=3*Math.sin(t*.68);
    const rise=7*Math.sin(t*1.05);
    gl.useProgram(shader);camera(shader);
    gl.uniform2f(uniform(shader,'center'),center[0]+drift,center[1]-57-rise);
    gl.uniform1f(uniform(shader,'time'),t);gl.uniform1f(uniform(shader,'emission'),emission);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.bindVertexArray(vao);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);
    gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,0,6);gl.depthMask(true);gl.disable(gl.BLEND);
  }};
}
