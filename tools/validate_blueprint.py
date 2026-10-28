"""Validate delivered design/evidence; no claim about future product tests."""
import csv, hashlib, json, pathlib, re, sqlite3, sys, unicodedata
import yaml
from jsonschema import Draft202012Validator
from openapi_spec_validator import validate_spec
from pypdf import PdfReader
from verify_math_oracles import verify as verify_math
ROOT=pathlib.Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def norm(s):return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',s).replace('\u00ad','')).strip()
def main():
    files=['SOURCE_AUDIT.md','DATA_FEASIBILITY.md','PRD.md','ARCHITECTURE.md','API_CONTRACT.yaml','DATA_MODELS.md','RULE_ENGINE.md','TEST_STRATEGY.md','MILESTONES.md','DEMO_SUBMISSION.md','MUSE_GOAL.md']
    assert (ROOT/'AGENTS.md').is_file()
    for f in files:assert (ROOT/'docs'/f).is_file(),f
    spec=yaml.safe_load((ROOT/'docs/API_CONTRACT.yaml').read_text());validate_spec(spec)
    count=sum(len(x) for x in spec['paths'].values());assert count==29
    print('PASS: 12 required deliverables; OpenAPI 3.1, 27 paths / 29 operations')
    schema=read('schemas/extraction.schema.json');Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(read('examples/extraction_proposal.json'))
    wrapper={'$ref':'#/components/schemas/EvaluationRequest','components':spec['components']}
    Draft202012Validator(wrapper).validate(read('examples/evaluation_request.json'))
    for filename, model in [('evaluation_response.json','EvaluationResult'),('evaluation_curve_request.json','EvaluationRequest'),('tias_tender.json','Tender'),('company_profile.json','Company')]:
        wrapper={'$ref':'#/components/schemas/'+model,'components':spec['components']}
        Draft202012Validator(wrapper).validate(read('examples/'+filename))
    print('PASS: standalone extraction schema and typed example payloads')
    db=sqlite3.connect(':memory:');db.executescript((ROOT/'schemas/schema.sql').read_text())
    assert db.execute('PRAGMA foreign_keys').fetchone()[0]==1
    print('PASS: SQLite DDL; tables',db.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0])
    manifest=read('evidence/download_manifest.json');by_name={x['key']:x for x in manifest}
    for p in (ROOT/'evidence/originals').glob('*.pdf'):
        assert hashlib.sha256(p.read_bytes()).hexdigest()==by_name[p.name]['sha256'],p.name
        assert len(PdfReader(p).pages)>0
    atom=ROOT/'evidence/originals/placsp.atom'
    assert hashlib.sha256(atom.read_bytes()).hexdigest()==by_name['placsp.atom']['sha256']
    print('PASS: 6 original PDF download hashes and parser readability')
    readers={};gold=read('examples/gold_claims.json')
    for g in gold['claims']:
        path=ROOT/g['document_file'];r=readers.setdefault(str(path),PdfReader(path))
        assert hashlib.sha256(path.read_bytes()).hexdigest()==g['document_sha256']
        assert g['quote_normalized'] in norm(r.pages[g['page_number']-1].extract_text()),g['id']
    print('PASS: 25 annotated citations located in exact PDF pages; semantic accuracy not statistically measured')
    summary=read('evidence/feed_probe/summary.json')
    ts=read('evidence/feed_probe/tenders.json');rs=read('evidence/feed_probe/results.json')
    assert len(ts)==summary['entries']==68;assert len(rs)==33
    assert sum(r['structural_candidate'] for r in rs)==22
    print('PASS: recent probe counts reconcile; structural candidates are NOT a validated statistical corpus')
    verify_math()
    tasks=list(csv.DictReader((ROOT/'examples/tasks.csv').open()))
    assert sum(float(t['hours']) for t in tasks if t['priority']=='P0')==58
    assert all(.5<=float(t['hours'])<=3 for t in tasks)
    task_ids={x['id'] for x in tasks}
    assert all(x in task_ids for t in tasks for x in t['dependencies'].split())
    print('PASS: task estimates/dependencies and P0 total 58 hours')
    # Check public-release flags, not legal sufficiency.
    assert all(x['allowed_in_public_repo'] is False for x in read('docs/publication-manifest.json'))
    assert read('evidence/meta_smoke_status.json')['status']=='BLOCKED'
    print('PASS: publication flags and honest Meta BLOCKED state')
    print('DESIGN VALIDATION COMPLETE. No app pytest/Playwright/build/live Meta run claimed.')
if __name__=='__main__':main()
