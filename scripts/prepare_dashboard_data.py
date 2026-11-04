"""Reproducible, read-only extraction of BITRE's September 2023 workbooks.

GenAI acknowledgement: OpenAI Codex assisted this script on 4 November 2026.
The original team CSVs and KNIME workflow are preserved. This extraction extends
the dashboard data; the team must reproduce/record these steps in its KNIME file.
No suppressed cell is converted to zero or recovered by subtracting totals.
"""
from pathlib import Path
from collections import defaultdict
import argparse, csv, hashlib, json, shutil
import openpyxl

REPO = Path(__file__).resolve().parents[1]
FILES = [
    'hospitalisation_injury_publication_sep2023.xlsx',
    'state-and-territory-hospitalisation-injury-publication-2023.xlsx',
    'First-Nations-hospitalised-injuries-2023.xlsx',
]
AGES = ['0-7','8-16','17-25','26-39','40-64','65-74','75+','Unknown']
SEXES = ['Male','Female','Other / unknown']
AREAS = ['Major Cities','Regional','Remote','Other / unknown']
ROADS = ['Car driver','Car passenger','Car unknown position','Motorcyclist',
         'Pedal cyclist','Pedestrian','Heavy transport driver',
         'Heavy transport passenger','Heavy transport unknown position',
         'Pick-up truck or van occupant','Bus occupant','Other or unknown']
STATES = ['NSW','Vic','Qld','SA','WA','Tas','NT','ACT']

def number(value):
    return int(value) if isinstance(value,(int,float)) else None

def output_csv(path, fields, rows):
    with path.open('w',newline='',encoding='utf-8') as fh:
        writer=csv.DictWriter(fh,fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)

def published_facets(wb, name, dimension):
    """Read the two separately published status sections without joining them."""
    out=[]; status=None; headers=[]
    for row in wb[name].iter_rows(values_only=True):
        first=row[0]
        if isinstance(first,str) and 'First Nations peoples' in first:
            status='First Nations'
        elif isinstance(first,str) and 'Non-Indigenous' in first:
            status='Non-Indigenous'
        elif first == 'Calendar year':
            headers=list(row)
        elif isinstance(first,(int,float)) and 2011<=first<=2021 and status:
            for i,label in enumerate(headers[1:],1):
                if label is None or 'total' in str(label).lower(): continue
                raw=row[i]; value=number(raw)
                out.append({'year':int(first),'status':status,'dimension':dimension,
                            'category':str(label).strip(),'value':value,
                            'suppressed':isinstance(raw,str) and 'n.p.' in raw})
    return out

def prepare(source_dir):
    out=REPO/'data'; originals=out/'source'; originals.mkdir(parents=True,exist_ok=True)
    for name in FILES:
        target=originals/name
        if (source_dir/name).resolve()!=target.resolve(): shutil.copy2(source_dir/name,target)
    wb=openpyxl.load_workbook(originals/FILES[0],read_only=True,data_only=True)
    expected={int(r[0]):int(r[1]) for r in wb['T1'].iter_rows(min_row=3,values_only=True)
              if isinstance(r[0],(int,float)) and 2011<=r[0]<=2021}
    counters=sorted({str(r[7]) for r in wb['raw'].iter_rows(min_row=2,values_only=True) if r[3]=='Traffic'})
    aggregate=defaultdict(lambda:[0,0]); raw_beds=0; died_beds=0; traffic_rows=0
    for row in wb['raw'].iter_rows(min_row=2,values_only=True):
        if row[3]!='Traffic': continue
        year=int(row[0]); age='Unknown' if row[4]=='Missing' else row[4]
        area='Other / unknown' if row[2]=='Missing' else row[2]
        sex=row[5] if row[5] in SEXES else 'Other / unknown'
        admissions=number(row[12]); beds=number(row[9]); death_beds=number(row[11])
        assert admissions is not None and beds is not None, 'Missing national numeric value'
        # Published Hospitalisations already excludes died cases. For bed days,
        # subtract the populated Died_bed_days field; blank subtraction matches
        # Excel's arithmetic treatment. Preserve the subtraction in provenance.
        death_beds=death_beds if death_beds is not None else 0
        key=(year,SEXES.index(sex),AGES.index(age),AREAS.index(area),
             ROADS.index(row[6]),counters.index(str(row[7])))
        aggregate[key][0]+=admissions; aggregate[key][1]+=beds-death_beds
        raw_beds+=beds; died_beds+=death_beds; traffic_rows+=1
    packed=[list(key)+values for key,values in sorted(aggregate.items())]
    annual={year:sum(r[6] for r in packed if r[0]==year) for year in expected}
    assert annual==expected, 'National traffic totals do not match published T1'
    assert all(r[6]>=0 and r[7]>=0 for r in packed)
    national={'schema':1,'fields':['year','sex','age','area','road','counterparty','admissions','bedDays'],
              'dimensions':{'sex':SEXES,'age':AGES,'area':AREAS,'road':ROADS,'counterparty':counters},
              'rows':packed,'annualControls':expected}
    wb.close()
    (out/'dashboard-national.json').write_text(json.dumps(national,separators=(',',':')),encoding='utf-8')
    flat=[dict(year=r[0],sex=SEXES[r[1]],age=AGES[r[2]],area=AREAS[r[3]],road=ROADS[r[4]],
               counterparty=counters[r[5]],admissions=r[6],bedDays=r[7]) for r in packed]
    output_csv(out/'dashboard-national.csv',list(flat[0]),flat)

    wb=openpyxl.load_workbook(originals/FILES[1],read_only=True,data_only=True)
    group=defaultdict(lambda:[0,0])
    for row in wb['raw'].iter_rows(min_row=3,values_only=True):
        if not isinstance(row[0],(int,float)) or row[5] not in STATES: continue
        cases,beds=number(row[3]),number(row[4])
        assert cases is not None and beds is not None
        key=(int(row[0]),row[5]);group[key][0]+=cases;group[key][1]+=beds
    states=[dict(year=y,state=s,admissions=v[0],bedDays=v[1]) for (y,s),v in sorted(group.items())]
    for row in wb['T1'].iter_rows(min_row=4,values_only=True):
        if not isinstance(row[0],(int,float)) or not 2011<=row[0]<=2021:continue
        for i,state in enumerate(STATES,1): assert group[(int(row[0]),state)][0]==row[i]
    wb.close()
    output_csv(out/'dashboard-states.csv',list(states[0]),states)

    wb=openpyxl.load_workbook(originals/FILES[2],read_only=True,data_only=True)
    annual_fn=[]
    for row in wb['T1'].iter_rows(min_row=4,values_only=True):
        if isinstance(row[0],(int,float)) and 2011<=row[0]<=2021:
            annual_fn.append(dict(year=int(row[0]),firstNations=number(row[1]),
                                 nonIndigenous=number(row[2]),total=number(row[3])))
    facets=published_facets(wb,'T2','road')+published_facets(wb,'T3','age')+published_facets(wb,'T4','area')
    assert len(annual_fn)==11 and all(r['total']==expected[r['year']] for r in annual_fn)
    assert any(r['suppressed'] and r['value'] is None for r in facets)
    wb.close()
    (out/'dashboard-comparisons.json').write_text(json.dumps({'states':states,'firstNations':annual_fn,'facets':facets},separators=(',',':')),encoding='utf-8')
    output_csv(out/'dashboard-first-nations.csv',list(facets[0]),facets)
    provenance={'prepared':'2026-11-04','publication':'BITRE Hospitalised Injury, September 2023',
       'sources':[{'file':n,'url':'https://www.bitre.gov.au/sites/default/files/documents/'+n,
                   'sha256':hashlib.sha256((originals/n).read_bytes()).hexdigest()} for n in FILES],
       'national':{'sourceTrafficRows':traffic_rows,'aggregatedRows':len(packed),'hospitalisations':sum(annual.values()),
                   'rawBedDays':raw_beds,'diedBedDaysSubtracted':died_beds,'bedDays':raw_beds-died_beds},
       'method':['Retain Cause of injury = Traffic only.',
                 'Use the published Hospitalisations column; do not subtract died cases twice.',
                 'Bed days = raw Bed days minus populated Died_bed_days.',
                 'Aggregate monthly records across year, sex, age, remoteness, road user and counterparty.',
                 'Map Missing age/residence to explicit Unknown categories; retain other/unknown sex.',
                 'Read state counts/bed days from the first independent raw block only; validate every state/year against T1.',
                 'Read First Nations published T1-T4 separately. Keep n.p. values null and do not infer them from totals.',
                 'Preserve the three legacy CSVs. New scripts extend preparation and must be reflected in the team KNIME workflow.'],
       'comparability':['Victoria 2012 and NSW 2017 admission-policy breaks.','Bed-day coding changed in 2015-16.',
                        'National and state fields describe residence, not crash location.',
                        'Counts are not population-adjusted risks. Bed-day ratios are aggregate resource-use measures.',
                        'First Nations tables have different category coverage; their totals need not equal T1.']}
    (out/'dashboard-provenance.json').write_text(json.dumps(provenance,indent=2),encoding='utf-8')
    print(json.dumps({'national':provenance['national'],'stateRows':len(states),'firstNationsFacetRows':len(facets),
                      'firstNations2021':annual_fn[-1],'checks':'Published annual and state/year totals match exactly; suppression preserved.'},indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source-dir',type=Path,default=REPO/'data/source')
    prepare(parser.parse_args().source_dir)
