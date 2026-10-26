"""Author the design-time OpenAPI contract; this is not a running API."""
import copy, json, pathlib, yaml
ROOT=pathlib.Path(__file__).resolve().parents[1]
S={}
def ref(n):return {'$ref':'#/components/schemas/'+n}
def arr(s,lo=0,hi=1000):return {'type':'array','items':s,'minItems':lo,'maxItems':hi}
def obj(p,required=None):return {'type':'object','properties':p,'required':list(p) if required is None else required,'additionalProperties':False}
def st(n=2000):return {'type':'string','maxLength':n}
def en(*v):return {'type':'string','enum':list(v)}
def nul(s):return {'anyOf':[s,{'type':'null'}]}
ID={'type':'string','pattern':'^[A-Za-z0-9_-]{1,80}$'}
DEC={'type':'string','pattern':r'^-?\d{1,12}(\.\d{1,12})?$','description':'Base-10 decimal string; no locale separators, NaN or Infinity.'}
MONEY={'type':'string','pattern':r'^\d{1,12}\.\d{2}$','description':'Nonnegative EUR net amount with two decimal places; positivity is a domain precondition.'}
BOOL={'type':'boolean'};INT={'type':'integer','minimum':1};DATE={'type':'string','format':'date'}
S['Error']=obj({'code':st(80),'message':st(),'request_id':st(80),'details':arr(st(),0,30)})
S['Health']=obj({'status':en('ok'),'engine_version':st(80),'schema_version':st(40)})
S['Capabilities']=obj({'mode':en('demo','live','manual'),'meta_configured':BOOL,'meta_model':st(80),'history_enabled':BOOL,'limits':obj({'pdf_bytes':INT,'pdf_pages':INT,'curve_points':INT}),'limitations':arr(st(),0,20)})
S['MetadataEvidence']=obj({'key':st(80),'source_url':st(3000),'snapshot_sha256':st(64),'field_path':st(1000),'raw_value':st(2000),'source_updated_at':st(80)})
S['PriceBasis']=obj({'scope_id':ID,'budget_net':nul(MONEY),'ceiling_net':nul(MONEY),'scoring_reference_net':nul(MONEY),'reference_kind':en('pbl','vec','custom','unknown'),'currency':en('EUR'),'unit':en('lump_sum','unit_price','percentage','framework_cap','unknown'),'period_months':nul(INT),'tax_kind':en('VAT','IGIC','other','unknown'),'review_status':en('pending','approved','blocked'),'evidence_ids':arr(ID,0,20),'metadata_evidence':arr(ref('MetadataEvidence'),0,20)})
S['Scope']=obj({'id':ID,'tender_id':ID,'lot_id':nul(st(80)),'label':st(300),'basis':ref('PriceBasis')})
S['Tender']=obj({'raw_snapshot_sha256':st(64),'metadata_evidence':arr(ref('MetadataEvidence'),0,30),'id':ID,'source_id':st(1000),'source_url':st(3000),'external_id':st(200),'title':st(2000),'contracting_body':st(1000),'cpv_codes':arr(st(12),0,30),'status_raw':st(40),'source_updated_at':st(80),'deadline_literal':nul(st(300)),'deadline_at':nul(st(80)),'pbl_net':nul(MONEY),'pbl_gross':nul(MONEY),'estimated_value':nul(MONEY),'scopes':arr(ref('Scope'),0,100),'quality_flags':arr(st(80),0,100)})
S['TenderCreate']=obj({'title':st(2000),'external_id':st(200),'source_url':nul(st(3000)),'contracting_body':st(1000)})
S['TenderList']=obj({'items':arr(ref('Tender'),0,100),'page':INT,'page_size':INT,'total':{'type':'integer','minimum':0}})
S['Document']=obj({'id':ID,'tender_id':ID,'kind':en('pcap','ppt','other'),'display_name':st(200),'sha256':{'type':'string','pattern':'^[a-f0-9]{64}$'},'pages_count':INT,'source_url':nul(st(3000)),'rights_status':en('research_only','reviewed_for_demo','redistribution_allowed','unknown'),'parse_status':en('queued','ready','needs_review','failed')})
S['PageText']=obj({'document_id':ID,'page_number':INT,'printed_label':nul(st(40)),'raw_text':st(100000),'normalized_text':st(100000),'text_sha256':st(64),'extractor_version':st(100),'quality_flags':arr(st(80),0,20)})
S['CitationProposal']=obj({'document_id':ID,'page_number':INT,'verbatim_excerpt':st(600)})
S['Citation']=obj({'id':ID,'document_id':ID,'document_sha256':st(64),'page_number':INT,'printed_label':nul(st(40)),'verbatim_excerpt':st(600),'match_status':en('exact','normalized_match','missing','manual_visual'),'normalized_start':nul({'type':'integer','minimum':0}),'normalized_end':nul({'type':'integer','minimum':0}),'normalization_version':st(40)})
S['ClaimProposal']=obj({'key':st(80),'raw_value':nul(st(2000)),'normalized_value':nul(st(2000)),'unit':nul(st(80)),'citations':arr(ref('CitationProposal'),0,3),'confidence':en('high','medium','low'),'status':en('proposed','not_found','ambiguous','unsupported'),'notes':arr(st(),0,10)})
S['RequirementProposal']=obj({'key':st(80),'label':st(1000),'category':en('financial','technical','team','legal','submission','other'),'logic_hint':en('AND','OR','LEAF','unknown'),'group_key':nul(st(80)),'condition_text':st(2000),'citations':arr(ref('CitationProposal'),0,3),'ambiguities':arr(st(),0,10)})
S['FormulaProposal']=obj({'formula_literal':nul(st(2000)),'template_hint':en('proportional_inverse','linear_discount','log_ratio','unsupported'),'max_points':nul(DEC),'variables':arr(st(300),0,20),'citations':arr(ref('CitationProposal'),0,3),'ambiguities':arr(st(),0,20)})
S['ExtractionProposal']=obj({'schema_version':en('1.0'),'claims':arr(ref('ClaimProposal'),0,80),'requirements':arr(ref('RequirementProposal'),0,80),'pricing_formula':ref('FormulaProposal'),'anomaly_text':nul(st(4000)),'anomaly_citations':arr(ref('CitationProposal'),0,5),'unread_pages':arr(INT,0,120),'warnings':arr(st(),0,30)})
S['RequirementLeaf']=obj({'kind':en('leaf'),'id':ID,'label':st(1000),'company_field':en('annual_turnover_best_3y_net','professional_insurance_net','net_worth_net','annual_similar_services_best_3y_net','team_feder_years','manual'),'operator':en('gte','lte','eq','contains','manual'),'threshold':nul(st(300)),'unit':nul(st(80)),'review_status':en('pending','approved','blocked'),'evidence_ids':arr(ID,0,20)})
S['RequirementGroup']=obj({'kind':en('group'),'id':ID,'label':st(1000),'operator':en('AND','OR'),'children':arr(ref('RequirementNode'),1,20)})
S['RequirementNode']={'oneOf':[ref('RequirementLeaf'),ref('RequirementGroup')]}
S['Expr']={'oneOf':[obj({'kind':en('const'),'value':DEC}),obj({'kind':en('var'),'name':en('own_price','best_price','reference_price','max_points')}),obj({'kind':en('call'),'op':en('add','sub','mul','div','min','max','log10'),'args':arr(ref('Expr'),1,8)})]}
S['AnomalyPolicy']=obj({'id':ID,'source_kind':en('explicit_pcap','verified_supplementary','unknown'),'variant':en('tias_18_5','alfresco_18_5','rglcap85_standard','unsupported'),'review_status':en('pending','approved','blocked'),'three_bidder_absolute_25':BOOL,'percentage_reduction_one_third':BOOL,'evidence_ids':arr(ID,0,20)})
S['PricingRule']=obj({'id':ID,'revision':INT,'scope_id':ID,'template_id':en('proportional_inverse','linear_discount','log_ratio','unsupported'),'max_points':DEC,'expression':nul(ref('Expr')),'review_status':en('pending','approved','blocked'),'zero_denominator_policy':en('unknown'),'evidence_ids':arr(ID,0,20),'anomaly_policy':ref('AnomalyPolicy')})
S['Workspace']=obj({'tender':ref('Tender'),'interpretation_revision':{'type':'integer','minimum':0},'mode':en('demo','live','manual'),'documents':arr(ref('Document'),0,20),'claims':arr(ref('ClaimProposal'),0,80),'requirements':arr(ref('RequirementNode'),0,80),'citations':arr(ref('Citation'),0,400),'pricing_rules':arr(ref('PricingRule'),0,100),'warnings':arr(st(),0,50)})
S['AnalysisRequest']=obj({'document_ids':arr(ID,1,10),'mode':en('live','curated_demo'),'allow_remote_processing':BOOL,'expected_interpretation_revision':{'type':'integer','minimum':0}})
S['Job']=obj({'id':ID,'tender_id':ID,'status':en('queued','running','succeeded','needs_review','failed','cancelled'),'stage':st(80),'processed_pages':{'type':'integer','minimum':0},'total_pages':{'type':'integer','minimum':0},'result_revision':nul(INT),'error_code':nul(st(80)),'warnings':arr(st(),0,30)})
S['ReviewRequest']=obj({'expected_revision':{'type':'integer','minimum':0},'approved_claim_keys':arr(st(80),0,80),'requirement_trees':arr(ref('RequirementNode'),0,80),'scope_basis':nul(ref('PriceBasis')),'pricing_rule':nul(ref('PricingRule')),'corrected_proposal':nul(ref('ExtractionProposal')),'actor':st(100),'reason':st(2000)})
S['CompanyEvidence']=obj({'field_key':st(80),'value':st(300),'unit':st(80),'period_from':nul(DATE),'period_to':nul(DATE),'source_type':en('synthetic','user_attestation','document_reference'),'reference':st(1000),'reviewed':BOOL})
S['CompanyWrite']=obj({'name':st(200),'synthetic':BOOL,'scope_id':ID,'period_months':INT,'direct_cost_net':nul(MONEY),'overhead_net':nul(MONEY),'target_margin_rate':nul(DEC),'evidence':arr(ref('CompanyEvidence'),0,100)})
S['Company']=obj({'id':ID,'revision':INT,**copy.deepcopy(S['CompanyWrite']['properties'])})
S['CompanyUpdate']=obj({'expected_revision':INT,**copy.deepcopy(S['CompanyWrite']['properties'])})
S['EligibilityRequest']=obj({'tender_id':ID,'scope_id':ID,'company_id':ID,'company_revision':INT,'interpretation_revision':INT})
S['EligibilityItem']=obj({'requirement_id':ID,'verdict':en('met','not_met','unknown'),'reason_codes':arr(st(80),0,20),'evidence_refs':arr(st(1000),0,20)})
S['EligibilityResult']=obj({'verdict':en('met','not_met','unknown'),'items':arr(ref('EligibilityItem'),0,100),'assessed_count':{'type':'integer','minimum':0},'unassessed_count':{'type':'integer','minimum':0},'hypothetical_company':BOOL})
S['RivalOffer']=obj({'label':st(100),'price_net':MONEY,'group_id':nul(st(80))})
S['RivalScenario']=obj({'state':en('assumed','unspecified'),'complete':BOOL,'group_membership_confirmed':BOOL,'own_group_id':nul(st(80)),'offers':arr(ref('RivalOffer'),0,20)})
S['CurveRequest']=obj({'from_discount_rate':DEC,'to_discount_rate':DEC,'points':{'type':'integer','minimum':2,'maximum':201}})
S['EvaluationRequest']=obj({'scope_id':ID,'pricing_rule_id':ID,'pricing_rule_revision':INT,'company_id':ID,'company_revision':INT,'discount_rate':DEC,'rivals':ref('RivalScenario'),'curve':nul(ref('CurveRequest'))})
S['ScoreResult']=obj({'status':en('defined','unknown','unsupported'),'value':nul(DEC),'max_points':DEC,'unknown_variables':arr(st(80),0,30),'reason_codes':arr(st(80),0,30)})
S['AnomalyResult']=obj({'status':en('unknown','not_applicable','possible_justification_required','not_flagged_under_assumptions'),'policy_id':ID,'branch':nul(st(80)),'reference_mean_net':nul(DEC),'threshold_net':nul(DEC),'reference_offer_count':{'type':'integer','minimum':0},'reason_codes':arr(st(80),0,30)})
S['TraceStep']=obj({'label':st(200),'expression':st(1000),'value':nul(DEC)})
S['CurvePoint']=obj({'discount_rate':DEC,'price_net':MONEY,'profit_net':nul(DEC),'margin_rate':nul(DEC),'score':ref('ScoreResult'),'anomaly_status':copy.deepcopy(S['AnomalyResult']['properties']['status'])})
S['EvaluationResult']=obj({'engine_version':st(40),'scope_id':ID,'pricing_rule_id':ID,'pricing_rule_revision':INT,'company_revision':INT,'price_net':MONEY,'cost_net':nul(MONEY),'profit_net':nul(DEC),'margin_rate':nul(DEC),'score':ref('ScoreResult'),'anomaly':ref('AnomalyResult'),'assumptions':arr(st(1000),0,40),'trace':arr(ref('TraceStep'),0,100),'curve':arr(ref('CurvePoint'),0,201),'source_hashes':arr(st(64),0,20),'warnings':arr(st(),0,30)})
S['ScenarioCreate']=obj({'name':st(200),'input':ref('EvaluationRequest')})
S['ScenarioContext']=obj({'basis':ref('PriceBasis'),'rule':ref('PricingRule'),'company':ref('Company'),'citations':arr(ref('Citation'),0,100),'tender_title':st(2000),'source_url':st(3000),'source_updated_at':st(80),'pending_items':arr(st(1000),0,100)})
S['Scenario']=obj({'context':ref('ScenarioContext'),'id':ID,'name':st(200),'input':ref('EvaluationRequest'),'result':ref('EvaluationResult'),'snapshot_sha256':st(64),'created_at':st(80)})
S['ReportCreate']=obj({'scenario_id':ID,'decision':en('study','prepare','discard'),'note':st(4000)})
S['Report']=obj({'id':ID,'scenario':ref('Scenario'),'decision':en('study','prepare','discard'),'note':st(4000),'pending_items':arr(st(1000),0,100),'html_path':st(300),'created_at':st(80)})
S['HistoricalAward']=obj({'source_id':st(1000),'source_url':st(3000),'lot_id':nul(st(80)),'pbl_net':MONEY,'award_net':MONEY,'discount_rate':DEC,'award_date':DATE,'cpv':st(12),'comparability':en('comparable'),'basis_note':st(2000)})
S['HistoryResult']=obj({'availability':en('disabled','insufficient','descriptive'),'n':{'type':'integer','minimum':0},'n_tenders':{'type':'integer','minimum':0},'items':arr(ref('HistoricalAward'),0,200),'median':nul(DEC),'q1':nul(DEC),'q3':nul(DEC),'exclusion_counts':arr(obj({'flag':st(80),'count':{'type':'integer','minimum':0}}),0,40),'warnings':arr(st(),0,30)})
S['DemoSession']=obj({'tender_id':ID,'scope_id':ID,'company_id':ID,'mode':en('demo')})

paths={}
def param(name,where,schema,required=False):return {'name':name,'in':where,'required':required,'schema':schema}
def add(path,method,operation,response,body=None,status='200',params=None,content='application/json'):
    parameters=[]
    for piece in path.split('/'):
        if piece.startswith('{'):parameters.append(param(piece[1:-1],'path',INT if piece=='{page_number}' else ID,True))
    if method in ['post','put','patch','delete']:
        parameters.append(param('X-BidLab-Client','header',en('local-ui'),True))
    if method=='post' and path.endswith(('/analysis','/scenarios','/reports','/demo/sessions')):
        parameters.append(param('Idempotency-Key','header',st(100),True))
    parameters+=(params or [])
    responses={status:{'description':'Successful response','content':{content:{'schema':ref(response) if response in S else ({'type':'string','format':'binary'} if content=='application/pdf' else {'type':'string'})}}}}
    if status=='202':responses[status]['headers']={'Location':{'schema':st(300),'description':'Local job resource URL'}}
    for code in ['400','403','404','409','413','415','422','429','502','503']:
        responses[code]={'description':'See Error.code for exact failure','content':{'application/json':{'schema':ref('Error')}}}
    op={'operationId':operation,'responses':responses}
    if parameters:op['parameters']=parameters
    if body:op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
    paths.setdefault(path,{})[method]=op
add('/api/v1/health','get','health','Health')
add('/api/v1/capabilities','get','capabilities','Capabilities')
add('/api/v1/demo/sessions','post','createDemoSession','DemoSession',status='201')
add('/api/v1/tenders','get','listTenders','TenderList',params=[param('q','query',st(200)),param('cpv','query',st(12)),param('page','query',{'type':'integer','minimum':1,'default':1}),param('page_size','query',{'type':'integer','minimum':1,'maximum':100,'default':20})])
add('/api/v1/tenders','post','createTender','Tender','TenderCreate',status='201')
add('/api/v1/tenders/{tender_id}','get','getTender','Tender')
add('/api/v1/tenders/{tender_id}/workspace','get','getWorkspace','Workspace')
add('/api/v1/tenders/{tender_id}/documents','post','uploadDocument','Document',status='201')
paths['/api/v1/tenders/{tender_id}/documents']['post']['requestBody']={'required':True,'content':{'multipart/form-data':{'schema':obj({'file':{'type':'string','format':'binary'},'kind':en('pcap','ppt','other'),'source_url':nul(st(3000))},['file','kind'])}}}
add('/api/v1/documents/{document_id}/pages/{page_number}','get','getPage','PageText')
add('/api/v1/documents/{document_id}/content','get','getDocumentContent','binary',content='application/pdf')
add('/api/v1/tenders/{tender_id}/analysis','post','startAnalysis','Job','AnalysisRequest',status='202')
add('/api/v1/jobs/{job_id}','get','getJob','Job')
add('/api/v1/tenders/{tender_id}/reviews','post','reviewInterpretation','Workspace','ReviewRequest')
add('/api/v1/companies','post','createCompany','Company','CompanyWrite',status='201')
add('/api/v1/companies/{company_id}','get','getCompany','Company')
add('/api/v1/companies/{company_id}','put','updateCompany','Company','CompanyUpdate')
add('/api/v1/eligibility/check','post','checkEligibility','EligibilityResult','EligibilityRequest')
add('/api/v1/scenarios/evaluate','post','evaluateScenario','EvaluationResult','EvaluationRequest')
add('/api/v1/scenarios','post','saveScenario','Scenario','ScenarioCreate',status='201')
add('/api/v1/scenarios/{scenario_id}','get','getScenario','Scenario')
add('/api/v1/reports','post','createReport','Report','ReportCreate',status='201')
add('/api/v1/reports/{report_id}','get','getReport','Report')
add('/api/v1/reports/{report_id}/html','get','getReportHtml','html',content='text/html')
add('/api/v1/historical-awards','get','getHistory','HistoryResult',params=[param('cpv','query',st(12)),param('before','query',DATE),param('nuts','query',st(20))])
spec={'openapi':'3.1.0','info':{'title':'BidLab local API','version':'1.0.0','description':'Design contract, not a deployed API. Decimal values are strings. Rules must be reviewed. Loopback only; mutations require same-origin validation and X-BidLab-Client.'},'servers':[{'url':'http://127.0.0.1:8000'}],'paths':paths,'components':{'schemas':S}}
(ROOT/'docs/API_CONTRACT.yaml').write_text(yaml.safe_dump(spec,sort_keys=False,allow_unicode=True))
# Standalone extraction schema, refs resolved into definitions for offline validation.
schema=copy.deepcopy(S['ExtractionProposal']);schema['$schema']='https://json-schema.org/draft/2020-12/schema'
schema['$defs']=copy.deepcopy(S)
def rewrite(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k=='$ref':x[k]=v.replace('#/components/schemas/','#/$defs/')
            else:rewrite(v)
    elif isinstance(x,list):
        for v in x:rewrite(v)
rewrite(schema)
# Include only transitive extraction definitions, keeping provider input schema small.
needed={'ClaimProposal','CitationProposal','RequirementProposal','FormulaProposal'}
schema['$defs']={k:v for k,v in schema['$defs'].items() if k in needed}
(ROOT/'schemas/extraction.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2))
print('Wrote OpenAPI',len(paths),'paths;',sum(len(v) for v in paths.values()),'operations;',len(S),'schemas')
