"""Download the official ABS 2021 state boundaries for the local D3 map.

GenAI acknowledgement: OpenAI Codex assisted this preparation, 12 November 2026.
Only geographic geometry is added. Hospital counts and bed-day data are unchanged.
"""
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import hashlib, json

REPO = Path(__file__).resolve().parents[1]
BASE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/STE/MapServer/1'
PARAMETERS = {'where': "state_code_2021 IN ('1','2','3','4','5','6','7','8')", 'outFields': 'state_code_2021,state_name_2021', 'returnGeometry': 'true', 'outSR': '4326', 'maxAllowableOffset': '0.025', 'geometryPrecision': '3', 'f': 'geojson'}
URL = BASE + '/query?' + urlencode(PARAMETERS)
STATE_CODES = {'1':'NSW','2':'Vic','3':'Qld','4':'SA','5':'WA','6':'Tas','7':'NT','8':'ACT'}

def ring_area(ring):
    return sum(a[0]*b[1] - b[0]*a[1] for a,b in zip(ring,ring[1:])) / 2

def prepare():
    target = REPO/'data/source/abs-ste2021-generalised.geojson'
    raw = target.read_bytes() if target.exists() else urlopen(Request(URL, headers={'User-Agent':'Group16-COS30045-student-project'}), timeout=60).read()
    source = json.loads(raw)
    assert source.get('type') == 'FeatureCollection', source.get('error')
    target.write_bytes(raw)
    features=[]
    for feature in source['features']:
        props = feature['properties']
        code = str(props['state_code_2021'])
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type']=='MultiPolygon' else [geometry['coordinates']]
        # D3's spherical convention is clockwise exterior / counterclockwise holes.
        # Reversing ring order preserves coordinates and locations exactly.
        fixed=[]
        for polygon in polygons:
            # Generalisation and three-decimal rounding can collapse tiny islets
            # into degenerate triangles. Omit exteriors below 0.0005 square
            # degrees (~a few km²); keep the source response unchanged.
            if abs(ring_area(polygon[0])) < 0.0005: continue
            rings=[]
            for i,ring in enumerate(polygon):
                if i and abs(ring_area(ring)) < 0.0005: continue
                if (ring_area(ring)>0) == (i==0): ring=list(reversed(ring))
                rings.append(ring)
            fixed.append(rings)
        features.append({'type':'Feature','properties':{'code':code,'state':STATE_CODES[code],'name':props['state_name_2021']},'geometry':{'type':'MultiPolygon','coordinates':fixed}})
    features.sort(key=lambda f:f['properties']['code'])
    assert len(features)==8 and {f['properties']['state'] for f in features}==set(STATE_CODES.values())
    output = REPO/'data/australia-states.geojson'
    output.write_text(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')),encoding='utf-8')
    provenance={'retrieved':'2026-11-12','publisher':'Australian Bureau of Statistics','title':'ASGS Edition 3, 2021 state and territory generalised boundaries','service':BASE,'queryUrl':URL,'sourcePage':'https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/data-services-and-apis','rawFile':'data/source/abs-ste2021-generalised.geojson','rawSha256':hashlib.sha256(raw).hexdigest(),'preparedFile':'data/australia-states.geojson','preparedSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'featureCount':8,'method':['Request codes 1–8; Other Territories excluded because hospital table has eight named states/territories.','Request WGS84 longitude/latitude, maximum allowable offset 0.025 degrees, geometry precision 3.','Retain original response; map state codes to BITRE abbreviations.','Omit tiny/degenerate exterior or hole rings with absolute planar area below 0.0005 square degrees for this national-scale display.','Orient retained polygon rings for D3 spherical rendering; no hospital measures changed.','Use this geographic outline for the full 2011–2021 series; it is not a historical boundary-change analysis.'],'attribution':'Australian Bureau of Statistics. ASGS Edition 3 (2021). Creative Commons Attribution 4.0, except where otherwise stated. Source geometry generalised for visualisation.'}
    (REPO/'data/map-provenance.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
    print(json.dumps({'features':len(features),'rawBytes':len(raw),'preparedBytes':output.stat().st_size,'states':[f['properties']['state'] for f in features]},indent=2))

if __name__=='__main__': prepare()
