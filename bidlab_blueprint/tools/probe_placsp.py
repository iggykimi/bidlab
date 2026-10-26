"""Small, deterministic feasibility probe. Does not infer comparability or rivals."""
import argparse, collections, csv, hashlib, json, pathlib, zipfile
from decimal import Decimal
from lxml import etree

A = "http://www.w3.org/2005/Atom"
NS = {"a": A, "cbc": "urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2",
      "cac": "urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2",
      "ext": "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonAggregateComponents-2",
      "bext": "urn:dgpe:names:draft:codice-place-ext:schema:xsd:CommonBasicComponents-2"}
def txt(e, path):
    return e.findtext(path, default=None, namespaces=NS) if e is not None else None
def nodes(e, path):
    return e.findall(path, NS) if e is not None else []
def parse(data):
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    if b"<!DOCTYPE" in data.upper(): raise ValueError("DTD rejected")
    return etree.fromstring(data, parser)
def analyze(data, origin):
    root = parse(data); tenders=[]; results=[]; docs=[]
    for e in nodes(root, "a:entry"):
        c=e.find("ext:ContractFolderStatus",NS)
        if c is None: continue
        pid=txt(e,"a:id"); project=c.find("cac:ProcurementProject",NS)
        links=nodes(e,"a:link")
        row=dict(source_id=pid, source_url=links[0].get("href") if links else None,
                 external_id=txt(c,"cbc:ContractFolderID"),updated=txt(e,"a:updated"),
                 title=txt(e,"a:title"),status=txt(c,"bext:ContractFolderStatusCode"),
                 pbl_net=txt(project,"cac:BudgetAmount/cbc:TaxExclusiveAmount"),
                 pbl_gross=txt(project,"cac:BudgetAmount/cbc:TotalAmount"),
                 estimated_value=txt(project,"cac:BudgetAmount/cbc:EstimatedOverallContractAmount"),
                 cpv=[x.text for x in nodes(project,"cac:RequiredCommodityClassification/cbc:ItemClassificationCode")],
                 nuts=txt(project,"cac:RealizedLocation/cbc:CountrySubentityCode"),
                 lot_count=len(nodes(c,"cac:ProcurementProjectLot")),
                 result_count=len(nodes(c,"cac:TenderResult")),
                 source_file=origin)
        tenders.append(row)
        for kind in ["LegalDocumentReference","TechnicalDocumentReference"]:
            for d in nodes(c,"cac:"+kind):
                docs.append(dict(source_id=pid,kind=kind,label=txt(d,"cbc:ID"),url=txt(d,"cac:Attachment/cac:ExternalReference/cbc:URI")))
        for i,t in enumerate(nodes(c,"cac:TenderResult")):
            lot=txt(t,"cac:AwardedTenderedProject/cbc:ProcurementProjectLotID")
            lot_project=next((p.find("cac:ProcurementProject",NS) for p in nodes(c,"cac:ProcurementProjectLot") if txt(p,"cbc:ID")==lot),None)
            base=txt(lot_project,"cac:BudgetAmount/cbc:TaxExclusiveAmount") if lot else row["pbl_net"]
            amount=txt(t,"cac:AwardedTenderedProject/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount")
            currency_node=t.find("cac:AwardedTenderedProject/cac:LegalMonetaryTotal/cbc:TaxExclusiveAmount",NS)
            flags=[]
            if row['lot_count'] and not lot: flags.append('unresolved_lot_scope')
            if row['result_count'] > 1 and not lot: flags.append('unresolved_multiple_awards')
            if not base: flags.append('missing_scope_budget')
            if not amount: flags.append('missing_award_net')
            if not nodes(t,'cac:WinningParty'): flags.append('no_winner')
            if amount and Decimal(amount)<=0: flags.append('nonpositive_award')
            if base and Decimal(base)<=0: flags.append('nonpositive_budget')
            if base and amount and Decimal(amount)>Decimal(base):flags.append('award_above_budget')
            # This is only a structural candidate; PCAP/scope review remains mandatory.
            candidate=not flags
            ratio=str((Decimal(base)-Decimal(amount))/Decimal(base)) if candidate else None
            results.append(dict(source_id=pid,result_index=i,lot_id=lot,result_code=txt(t,'cbc:ResultCode'),
              award_date=txt(t,'cbc:AwardDate'),received_count=txt(t,'cbc:ReceivedTenderQuantity'),
              lower_amount=txt(t,'cbc:LowerTenderAmount'),higher_amount=txt(t,'cbc:HigherTenderAmount'),
              award_net=amount,currency=currency_node.get('currencyID') if currency_node is not None else None,
              scope_pbl_net=base,structural_candidate=candidate,candidate_discount=ratio,
              semantic_comparability='UNREVIEWED',quality_flags=flags))
    return tenders,results,docs
def output_csv(path, rows):
    if not rows:return
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader()
        for row in rows:w.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in row.items()})
def main():
    p=argparse.ArgumentParser();p.add_argument('input',type=pathlib.Path);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    ts=[];rs=[];ds=[];members=[]
    if a.input.suffix=='.zip':
        with zipfile.ZipFile(a.input) as z:
            for m in z.infolist():
                if not m.filename.endswith('.atom'):continue
                if m.file_size>64*1024*1024:raise ValueError('oversized member')
                t,r,d=analyze(z.read(m),m.filename);ts+=t;rs+=r;ds+=d;members.append(m.filename)
    else:ts,rs,ds=analyze(a.input.read_bytes(),a.input.name)
    a.out.mkdir(parents=True,exist_ok=True)
    # Keep latest observed version for summary; raw version count is retained.
    latest={}
    for t in ts:
        if t['source_id'] not in latest or t['updated']>latest[t['source_id']]['updated']:latest[t['source_id']]=t
    summary=dict(input_sha256=hashlib.sha256(a.input.read_bytes()).hexdigest(),entries=len(ts),unique_tenders=len(latest),
      duplicate_versions=len(ts)-len(latest),result_records=len(rs),zip_members=len(members),
      tender_nonnull={k:sum(t[k] is not None and t[k]!=[] for t in ts) for k in ['pbl_net','pbl_gross','estimated_value','cpv','nuts']},
      tenders_with_lots=sum(t['lot_count']>0 for t in ts),tenders_with_results=sum(t['result_count']>0 for t in ts),
      tenders_with_legal_document=len({d['source_id'] for d in ds if d['kind']=='LegalDocumentReference' and d['url']}),
      result_nonnull={k:sum(r[k] is not None for r in rs) for k in ['award_net','received_count','lower_amount','higher_amount']},
      structural_candidates=sum(r['structural_candidate'] for r in rs),
      quality_flag_counts=dict(collections.Counter(flag for r in rs for flag in r['quality_flags'])),
      status_counts=dict(collections.Counter(t['status'] for t in ts)))
    for name,rows in [('tenders',ts),('results',rs),('documents',ds)]:
        output_csv(a.out/(name+'.csv'),rows);(a.out/(name+'.json')).write_text(json.dumps(rows,ensure_ascii=False,indent=2))
    (a.out/'summary.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
