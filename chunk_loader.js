/* Stream large Godot files from static-host-sized pieces without keeping all pieces in JS memory. */
globalThis.installMistChunkedFetch = function(manifest, originalFetch, baseURL) {
 const base = new URL(baseURL);
 return async function(resource, options) {
  const url = new URL(typeof resource === 'string' || resource instanceof URL ? resource : resource.url, base);
  const relative = url.href.startsWith(base.href) ? url.pathname.slice(base.pathname.length) : '';
  const asset = manifest[relative];
  if(!asset || (options?.method && options.method !== 'GET')) return originalFetch(resource, options);
  let index=0, reader=null;
  const stream=new ReadableStream({
   async pull(controller) {
    try {
     while(true) {
      if(reader) {
       const part=await reader.read();
       if(!part.done){controller.enqueue(part.value);return;}
       reader.releaseLock();reader=null;
      }
      if(index>=asset.chunks.length){controller.close();return;}
      const response=await originalFetch(new URL(asset.chunks[index++],base),options);
      if(!response.ok)throw new Error('资源下载失败：HTTP '+response.status);
      reader=response.body.getReader();
     }
    }catch(error){controller.error(error);}
   },
   async cancel(reason){if(reader)await reader.cancel(reason);}
  });
  return new Response(stream,{headers:{'Content-Type':asset.type||'application/octet-stream','Content-Length':String(asset.size)}});
 };
};
