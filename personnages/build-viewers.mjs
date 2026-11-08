import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
import vm from 'node:vm';

const CHARACTERS = [
  {
    slug: 'riskick',
    glbName: 'riskick-v1.glb',
    loadPath: './models/personnages/riskick/riskick-v1.glb',
    siblingSlug: 'preventeur-guy',
  },
  {
    slug: 'preventeur-guy',
    glbName: 'preventeur-guy-v1.glb',
    loadPath: './models/personnages/preventeur-guy/preventeur-guy-v1.glb',
    siblingSlug: 'riskick',
  },
];

for (const ch of CHARACTERS) {
  const template = await readFile(`personnages/${ch.slug}/viewer.html`, 'utf8');
  const model = await readFile(`personnages/${ch.slug}/${ch.glbName}`);

  let code = template.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  code = `const modelBytes = Uint8Array.from(atob('${model.toString('base64')}'), c => c.charCodeAt(0));\n` + code;
  code = code.replace(`new GLTFLoader().load('${ch.loadPath}',`, "new GLTFLoader().parse(modelBytes.buffer,'',");
  code = code.replace('},undefined,()=>{', '},()=>{');
  code += `\nconst modelLink=document.querySelector('a[download]');
modelLink.href=URL.createObjectURL(new Blob([modelBytes],{type:'model/gltf-binary'}));
modelLink.download='${ch.glbName}';\n`;

  const result = await build({
    stdin: { contents: code, resolveDir: process.cwd(), sourcefile: `${ch.slug}-viewer.js` },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    write: false,
  });

  const bundled = result.outputFiles[0].text;
  new vm.Script(bundled); // The offline page must contain ordinary, self-contained JavaScript.

  const baseHtml = template
    .replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
    .replace(
      /<script type="module">[\s\S]*?<\/script>/,
      () => `<script>try{${bundled.replace(/<\/script/gi, '<\\/script')}}catch(error){document.querySelector('#status').textContent='Affichage 3D indisponible : '+error.message;}</script>`
    )
    .replace('#status{position:absolute;top:110px;left:28px}', '#status{position:absolute;top:170px;left:28px;right:28px}')
    .replace(`href="${ch.loadPath}" download`, `href="#" download="${ch.glbName}"`);

  if (baseHtml.includes('type="module"') || baseHtml.includes('type="importmap"') || !baseHtml.includes('model/gltf-binary')) {
    throw new Error(`Incomplete standalone viewer for ${ch.slug}`);
  }

  // Version dans le sous-dossier du personnage : lien vers ../<autre>/<autre>.html
  const folderHtml = baseHtml.replace(`href="./${ch.siblingSlug}.html"`, `href="../${ch.siblingSlug}/${ch.siblingSlug}.html"`);
  await writeFile(`personnages/${ch.slug}/${ch.slug}.html`, folderHtml);

  // Version à la racine public/ et dist/ : lien vers ./<autre>.html
  await writeFile(`public/${ch.slug}.html`, baseHtml);
  await mkdir('dist', { recursive: true });
  await writeFile(`dist/${ch.slug}.html`, baseHtml);

  console.log(`[${ch.slug}] Standalone viewer ready: ${Buffer.byteLength(baseHtml)} bytes; embedded GLB: ${model.length} bytes.`);
}
