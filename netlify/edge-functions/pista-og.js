/**
 * pista-og.js — Edge Function que inyecta Open Graph dinámico en pista.html.
 *
 * Los scrapers de redes sociales no ejecutan JavaScript, así que no pueden
 * leer los datos del cover que carga pista.js. Esta función intercepta la
 * petición, lee el JSON del cover, y devuelve el HTML con los meta OG ya
 * rellenos antes de que llegue al scraper.
 *
 * Configurada en netlify.toml: path = "/pista.html"
 */

function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

export default async (request, context) => {
  const url   = new URL(request.url);
  const fecha = url.searchParams.get('fecha');

  // Sin fecha → sirve el HTML original sin modificar
  const response = await context.next();
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return response;

  // Carga el JSON del cover desde el mismo origen
  let cover;
  try {
    const jsonRes = await fetch(new URL(`/content/covers/${fecha}.json`, request.url));
    if (!jsonRes.ok) return response;
    cover = await jsonRes.json();
  } catch {
    return response;
  }

  // Construye los valores OG
  const title  = escapeAttr(`${cover.interpreteCover} versiona a ${cover.artistaOriginal} · Refrito`);
  const rawDesc = stripHtml(cover.textoCuratorial || '');
  const desc   = escapeAttr(
    rawDesc.length > 155 ? rawDesc.slice(0, 154) + '…' : rawDesc ||
    `Pista ${cover.numeroPista}: "${cover.tituloCancion}" — cover de ${cover.interpreteCover}`
  );
  // YouTube sirve JPEG de alta resolución — funciona en todas las plataformas
  const image  = `https://img.youtube.com/vi/${cover.youtubeId}/maxresdefault.jpg`;
  const pageUrl = escapeAttr(`https://refrito.org/pista.html?fecha=${fecha}`);

  const ogTags = `
  <!-- Open Graph dinámico — inyectado por Edge Function -->
  <meta property="og:type"         content="article">
  <meta property="og:site_name"    content="Refrito">
  <meta property="og:locale"       content="es_ES">
  <meta property="og:url"          content="${pageUrl}">
  <meta property="og:title"        content="${title}">
  <meta property="og:description"  content="${desc}">
  <meta property="og:image"        content="${image}">
  <meta property="og:image:width"  content="1280">
  <meta property="og:image:height" content="720">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image"       content="${image}">
  <title>${title}</title>`;

  // Reemplaza el bloque de fallback en el HTML
  const html     = await response.text();
  const modified = html
    .replace(/\s*<!-- Open Graph \(valores base[^>]*-->\s*[\s\S]*?(?=\n<\/head>)/, ogTags)
    .replace(/<title>Pista — Refrito<\/title>/, ''); // el nuevo <title> ya va en ogTags

  return new Response(modified, {
    status:  response.status,
    headers: { ...Object.fromEntries(response.headers), 'content-type': 'text/html; charset=utf-8' },
  });
};
