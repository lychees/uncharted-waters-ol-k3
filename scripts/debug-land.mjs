// 调试：检查陆地三角化是否产生跨大洋的巨型三角形
import earcut from 'earcut';
import { feature } from 'topojson-client';
import { readFileSync } from 'node:fs';

const topo = JSON.parse(readFileSync('public/data/land-110m.json', 'utf8'));
const geo = feature(topo, topo.objects.land);

const polygons = [];
for (const f of geo.features) {
  const g = f.geometry;
  if (g.type === 'Polygon') polygons.push(g.coordinates);
  else if (g.type === 'MultiPolygon') polygons.push(...g.coordinates);
}
console.log('polygons:', polygons.length);

function unwrapRing(ring) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let lon = ring[i][0];
    const prev = out[i - 1][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

function unwrapPolygon(poly) {
  const outer = unwrapRing(poly[0]);
  if (poly.length === 1) return [outer];
  let min = Infinity, max = -Infinity;
  for (const [lon] of outer) { if (lon < min) min = lon; if (lon > max) max = lon; }
  const center = (min + max) / 2;
  const rings = [outer];
  for (let i = 1; i < poly.length; i++) {
    const hole = unwrapRing(poly[i]);
    const hMean = hole.reduce((s, p) => s + p[0], 0) / hole.length;
    const shift = Math.round((center - hMean) / 360) * 360;
    rings.push(hole.map(([lon, lat]) => [lon + shift, lat]));
  }
  return rings;
}

const offenders = [];
polygons.forEach((poly, pi) => {
  const rings = unwrapPolygon(poly);
  const flat = [];
  for (const ring of rings) for (const [lon, lat] of ring) flat.push(lon, lat);
  const holeIndices = [];
  let count = 0;
  for (let i = 1; i < rings.length; i++) {
    count += rings[i - 1].length;
    holeIndices.push(count);
  }
  const tris = earcut(flat, holeIndices.length ? holeIndices : undefined, 2);
  let maxArea = 0;
  let maxTri = null;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i] * 2, tris[i + 1] * 2, tris[i + 2] * 2];
    const area = Math.abs(
      (flat[b] - flat[a]) * (flat[c + 1] - flat[a + 1]) -
      (flat[c] - flat[a]) * (flat[b + 1] - flat[a + 1])
    ) / 2;
    if (area > maxArea) {
      maxArea = area;
      maxTri = [
        [flat[a], flat[a + 1]],
        [flat[b], flat[b + 1]],
        [flat[c], flat[c + 1]],
      ];
    }
  }
  const lats = poly[0].map((p) => p[1]);
  const centroidLat = lats.reduce((s, v) => s + v, 0) / lats.length;
  if (maxArea > 200) {
    offenders.push({ pi, maxArea: maxArea.toFixed(0), centroidLat: centroidLat.toFixed(1), rings: poly.length, maxTri });
  }
});

console.log('offenders (area > 200 平方度):');
for (const o of offenders) console.log(JSON.stringify(o));
