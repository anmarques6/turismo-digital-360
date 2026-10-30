# Extrai do ficheiro completo de Angola do OpenStreetMap (Geofabrik, angola-latest.osm.pbf) os lugares turísticos,
# no mesmo formato da API Overpass, para importar com:  OSM_FICHEIRO=lugares.json node scripts/importar-osm.js
#   pip install osmium ; curl -LO https://download.geofabrik.de/africa/angola-latest.osm.pbf
#   python3 scripts/extrair-osm.py angola-latest.osm.pbf lugares.json
import sys, json, re, osmium

def interessa(t):
    if 'name' not in t and 'name:pt' not in t: return False
    if t.get('natural') in ('beach', 'waterfall'): return True
    if t.get('boundary') == 'national_park': return True
    if re.fullmatch(r'museum|viewpoint|zoo|theme_park|hotel|motel|guest_house|hostel|apartment|chalet', t.get('tourism', '')): return True
    if re.fullmatch(r'fort|castle|monument|archaeological_site', t.get('historic', '')): return True
    if t.get('leisure') == 'resort' or t.get('amenity') == 'restaurant': return True
    return False

class H(osmium.SimpleHandler):
    def __init__(s): super().__init__(); s.out = []; s.vistos = set()
    def guarda(s, tipo, i, lat, lon, tags):
        k = f'{tipo}/{i}'
        if k in s.vistos: return
        s.vistos.add(k); el = {'type': tipo, 'id': i, 'tags': tags}
        if tipo == 'node': el['lat'], el['lon'] = lat, lon
        else: el['center'] = {'lat': lat, 'lon': lon}
        s.out.append(el)
    def node(s, n):
        t = dict(n.tags)
        if interessa(t) and n.location.valid(): s.guarda('node', n.id, n.location.lat, n.location.lon, t)
    def way(s, w):
        t = dict(w.tags)
        if not interessa(t): return
        pts = [(n.lat, n.lon) for n in w.nodes if n.location.valid()]
        if pts: s.guarda('way', w.id, sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), t)
    def area(s, a):
        if a.from_way(): return
        t = dict(a.tags)
        if not interessa(t): return
        pts = [(n.lat, n.lon) for r in a.outer_rings() for n in r if n.location.valid()]
        if pts: s.guarda('relation', a.orig_id(), sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts), t)

h = H(); h.apply_file(sys.argv[1], locations=True, idx='flex_mem')
json.dump({'elements': h.out, 'fonte': 'Geofabrik angola-latest.osm.pbf (OpenStreetMap, ODbL)'}, open(sys.argv[2], 'w'), ensure_ascii=False)
from collections import Counter
print(len(h.out), dict(Counter(next((f'{k}={e["tags"][k]}' for k in ('natural', 'boundary', 'tourism', 'historic', 'leisure', 'amenity') if k in e['tags']), '?') for e in h.out)))
