"""Author the design-time OpenAPI contract; this is not a running API.

Regenerate the contract:  python tools/build_contract.py
Regenerate clients (exact-repro, pinned):
  uvx --from datamodel-code-generator==0.86.0 datamodel-codegen \\
      --input docs/API_CONTRACT.yaml --input-file-type openapi \\
      --output apps/api/bidlab/schemas/generated.py \\
      --base-class bidlab.schemas.common.StrictModel \\
      --enum-field-as-literal all --use-annotated
  node_modules/.bin/openapi-typescript docs/API_CONTRACT.yaml \\
      -o apps/web/src/api/generated.ts   # 7.13.0

Importing this module has no side effects: build_spec() returns the contract
for the conformance test, and only main() writes files (needs PyYAML).
"""
import copy, json, pathlib, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
def ref(n):return {'$ref':'#/components/schemas/'+n}
def resp(n):return {'$ref':'#/components/responses/'+n}
def par(n):return {'$ref':'#/components/parameters/'+n}
def arr(s,lo=0,hi=1000):return {'type':'array','items':s,'minItems':lo,'maxItems':hi}
def obj(p,required=None):return {'type':'object','properties':p,'required':list(p) if required is None else required,'additionalProperties':False}
def st(n=2000):return {'type':'string','maxLength':n}
def st1(n):return {'type':'string','minLength':1,'maxLength':n}
def en(*v):return {'type':'string','enum':list(v)}
def nul(s):return {'anyOf':[s,{'type':'null'}]}
def param(name,where,schema,required=False,example=None):
    p={'name':name,'in':where,'required':required,'schema':schema}
    if example is not None:p['example']=example
    return p
def _example(operation,value):return {'example':{'summary':f'{operation} example','value':value}}
def _rewrite_refs(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if k=='$ref':x[k]=v.replace('#/components/schemas/','#/$defs/')
            else:_rewrite_refs(v)
    elif isinstance(x,list):
        for v in x:_rewrite_refs(v)
def build_spec():
    """Return (openapi_spec, schemas). Pure: no file writes, stdlib only."""
    S={}
    # O5: shared transport primitives. Every use site holds a $ref to one of
    # these; the JSON round-trip before dump keeps YAML anchors out of the file.
    S['EntityId']={'type':'string','pattern':'^[A-Za-z0-9_-]{1,80}$','description':'Opaque entity identifier (tender, scope, document, company, scenario, report, job).'}
    S['Decimal']={'type':'string','pattern':r'^-?\d{1,12}(\.\d{1,12})?$','description':'Base-10 decimal string; no locale separators, NaN or Infinity.'}
    S['Money']={'type':'string','pattern':r'^\d{1,12}\.\d{2}$','description':'Nonnegative EUR net amount with two decimal places; positivity is a domain precondition.'}
    ID=ref('EntityId');DEC=ref('Decimal');MONEY=ref('Money')
    BOOL={'type':'boolean'};INT={'type':'integer','minimum':1};DATE={'type':'string','format':'date'}
    # O4: every Error.code the API can emit. Groups mirror origin: envelope
    # handlers (errors.py), ApiError raise sites (api/services), domain codes
    # (surfaced via the domain handler or 422 exc.code passthroughs), PdfError
    # codes (served by the PdfError handler). http_N is NOT listed: the fallback
    # only fires for unreachable statuses (Starlette raises 404/405 here).
    _ERR_HANDLERS=('bad_request','conflict','domain_validation','extra_forbidden','forbidden','internal','method_not_allowed','not_found','provider_failure','rate_limited','upload_too_large','unsupported_media','validation_error')
    _ERR_API=('citation_unverified','claim_not_reviewable','ast_template_mismatch','basis_not_approved','budget_exhausted','company_not_found','company_profile_corrupt','company_scope_mismatch','company_without_revision','compare_invalid_request','curve_out_of_scope','demo_seed_incomplete','discount_out_of_scope','document_bytes_unavailable','document_duplicate','document_not_found','document_wrong_tender','eligibility_unserializable','forbidden','idempotency_conflict','interpretation_not_found','job_not_found','job_running','money_unparseable','nothing_to_review','page_not_found','provider_not_configured','remote_processing_not_allowed','report_corrupt','report_html_missing','report_not_found','requirements_tree_corrupt','requirements_tree_too_deep','revision_conflict','rule_malformed','rule_not_approved','rule_not_found','scenario_not_found','scenario_snapshot_incomplete','scope_not_found','scope_tender_mismatch','scope_without_budget','snapshot_corrupt','stale_revision','tender_not_found','unknown_claim_key','upload_not_pdf','period_mismatch','stress_constraints_invalid','stress_cost_invalid','stress_not_found')
    _ERR_DOMAIN=('arity','awarded_negative','bad_format','bad_kind','bad_node','bad_shape','bad_type','base_not_positive','bool_forbidden','budget_not_positive','ceiling_exceeded','const_bad_type','const_float_forbidden','const_non_finite','const_too_large','cost_negative','cycle','discount_out_of_range','domain_non_finite','empty_offer_set','float_forbidden','log_non_positive','margin_out_of_range','max_depth','max_points_not_positive','missing_variable','non_finite','not_positive','offer_not_positive','price_not_positive','reference_not_positive','too_many_nodes','too_many_ops','too_many_rivals','unknown_op','unknown_template','unknown_variable','unknown_variant')
    _ERR_PDF=('pdf_no_pages','pdf_page_unreadable','pdf_too_large','pdf_too_many_pages','pdf_unreadable')
    ERROR_CODES=tuple(sorted(set(_ERR_HANDLERS+_ERR_API+_ERR_DOMAIN+_ERR_PDF)))
    assert len(ERROR_CODES)==106, f'error-code enum drift: {len(ERROR_CODES)}'
    S['ErrorCode']={'type':'string','enum':list(ERROR_CODES),'description':'Machine-readable failure code; the frontend maps known codes to Spanish copy.'}
    S['Error']=obj({'code':ref('ErrorCode'),'message':st(),'request_id':st(80),'details':arr(st(),0,30)})
    S['Health']=obj({'status':en('ok'),'engine_version':st(80),'schema_version':st(40)})
    S['Ready']=obj({'status':en('ready','degraded'),'db_quick_check':st(80)})
    S['Capabilities']=obj({'mode':en('demo','live','manual'),'meta_configured':BOOL,'meta_model':st(80),'history_enabled':BOOL,'limits':obj({'pdf_bytes':INT,'pdf_pages':INT,'curve_points':INT}),'limitations':arr(st(),0,20)})
    S['MetadataEvidence']=obj({'key':st(80),'source_url':st(3000),'snapshot_sha256':st(64),'field_path':st(1000),'raw_value':st(2000),'source_updated_at':st(80)})
    S['PriceBasis']=obj({'scope_id':ID,'budget_net':nul(MONEY),'ceiling_net':nul(MONEY),'scoring_reference_net':nul(MONEY),'reference_kind':en('pbl','vec','custom','unknown'),'currency':en('EUR'),'unit':en('lump_sum','unit_price','percentage','framework_cap','unknown'),'period_months':nul(INT),'tax_kind':en('VAT','IGIC','other','unknown'),'review_status':en('pending','approved','blocked'),'evidence_ids':arr(ID,0,20),'metadata_evidence':arr(ref('MetadataEvidence'),0,20)})
    S['Scope']=obj({'id':ID,'tender_id':ID,'lot_id':nul(st(80)),'label':st(300),'basis':ref('PriceBasis')})
    S['Tender']=obj({'raw_snapshot_sha256':st(64),'metadata_evidence':arr(ref('MetadataEvidence'),0,30),'id':ID,'source_id':st(1000),'source_url':st(3000),'external_id':st(200),'title':st(2000),'contracting_body':st(1000),'cpv_codes':arr(st(12),0,30),'status_raw':st(40),'source_updated_at':st(80),'deadline_literal':nul(st(300)),'deadline_at':nul(st(80)),'pbl_net':nul(MONEY),'pbl_gross':nul(MONEY),'estimated_value':nul(MONEY),'scopes':arr(ref('Scope'),0,100),'quality_flags':arr(st(80),0,100)})
    S['TenderList']=obj({'items':arr(ref('Tender'),0,100),'page':INT,'page_size':INT,'total':{'type':'integer','minimum':0}})
    # Intake: own-tender creation. Money arrives as free-form strings and is
    # parsed server-side with the repo Decimal parser (never float); absent
    # amounts stay null (no tax inference). Caps mirror the Tender response.
    S['TenderBasisInput']=obj({'pbl_net':nul(st(32)),'pbl_gross':nul(st(32)),'tax_kind':nul(en('VAT','IGIC','other','unknown')),'period_months':nul(INT),'currency':nul(en('EUR'))})
    S['TenderCreate']=obj({'title':st1(2000),'external_id':st1(200),'contracting_body':st1(1000),'source_url':nul(st(3000)),'scope_label':nul(st(80)),'basis':nul(ref('TenderBasisInput'))})
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
    S['RequirementNode']={'oneOf':[ref('RequirementLeaf'),ref('RequirementGroup')],'discriminator':{'propertyName':'kind','mapping':{'leaf':'#/components/schemas/RequirementLeaf','group':'#/components/schemas/RequirementGroup'}}}
    S['ExprConst']=obj({'kind':en('const'),'value':DEC})
    S['ExprVar']=obj({'kind':en('var'),'name':en('own_price','best_price','reference_price','max_points')})
    S['ExprCall']=obj({'kind':en('call'),'op':en('add','sub','mul','div','min','max','log10'),'args':arr(ref('Expr'),1,8)})
    S['Expr']={'oneOf':[ref('ExprConst'),ref('ExprVar'),ref('ExprCall')],'discriminator':{'propertyName':'kind','mapping':{'const':'#/components/schemas/ExprConst','var':'#/components/schemas/ExprVar','call':'#/components/schemas/ExprCall'}}}
    S['AnomalyPolicy']=obj({'id':ID,'source_kind':en('explicit_pcap','verified_supplementary','unknown'),'variant':en('tias_18_5','alfresco_18_5','rglcap85_standard','unsupported'),'review_status':en('pending','approved','blocked'),'three_bidder_absolute_25':BOOL,'percentage_reduction_one_third':BOOL,'evidence_ids':arr(ID,0,20)})
    S['PricingRule']=obj({'id':ID,'revision':INT,'scope_id':ID,'template_id':en('proportional_inverse','linear_discount','log_ratio','unsupported'),'max_points':DEC,'expression':nul(ref('Expr')),'review_status':en('pending','approved','blocked'),'zero_denominator_policy':en('unknown'),'evidence_ids':arr(ID,0,20),'anomaly_policy':ref('AnomalyPolicy')})
    # T20: incoherence radar. Transport for pairwise observation findings;
    # the comparator lives in bidlab.services.consistency (pure domain).
    S['ConsistencyEvidence']=obj({'observation_id':st(80),'document_id':ID,'document_sha256':{'type':'string','pattern':'^[a-f0-9]{64}$'},'physical_page':INT,'verbatim_excerpt':nul(st(600)),'value':nul(st(2000))})
    S['ConsistencyFinding']=obj({'field':en('budget_net','period_months','max_price_points','pricing_formula_literal','anomaly_literal','other_requirement'),'same_document':BOOL,'evidence_a':ref('ConsistencyEvidence'),'evidence_b':ref('ConsistencyEvidence'),'question':st(1000),'synthetic':BOOL})
    S['ConsistencyReport']=obj({'items':arr(ref('ConsistencyFinding'),0,50),'synthetic_example':ref('ConsistencyFinding')})
    S['Workspace']=obj({'tender':ref('Tender'),'interpretation_revision':{'type':'integer','minimum':0},'mode':en('demo','live','manual'),'documents':arr(ref('Document'),0,20),'claims':arr(ref('ClaimProposal'),0,80),'requirements':arr(ref('RequirementNode'),0,80),'citations':arr(ref('Citation'),0,400),'pricing_rules':arr(ref('PricingRule'),0,100),'warnings':arr(st(),0,50),'consistency':ref('ConsistencyReport')})
    S['AnalysisRequest']=obj({'document_ids':arr(ID,1,10),'mode':en('live','curated_demo'),'allow_remote_processing':BOOL,'expected_interpretation_revision':{'type':'integer','minimum':0}})
    S['JobErrorCode']={'type':'string','maxLength':80,'description':'Terminal job failure code (free string: job outcomes predate the Error envelope).'}
    S['Job']=obj({'id':ID,'tender_id':ID,'status':en('queued','running','succeeded','needs_review','failed','cancelled'),'stage':st(80),'processed_pages':{'type':'integer','minimum':0},'total_pages':{'type':'integer','minimum':0},'result_revision':nul(INT),'error_code':nul(ref('JobErrorCode')),'warnings':arr(st(),0,30),'invocation_id':nul(ID),'mode':nul(en('fixture','live')),'model':nul(st(80)),'prompt_tokens':nul({'type':'integer','minimum':0}),'completion_tokens':nul({'type':'integer','minimum':0}),'estimated_cost_usd':nul(st(32)),'provider_request_id':nul(st(200)),'latency_ms':nul({'type':'integer','minimum':0})})
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
    S['DemoSession']=obj({'tender_id':ID,'scope_id':ID,'company_id':ID,'mode':en('demo')})
    _ANOMALY_STATUS=copy.deepcopy(S['AnomalyResult']['properties']['status'])
    _SCORE_STATUS=en('defined','unknown','unsupported')
    S['ScenarioSummary']=obj({'id':ID,'name':st(200),'scope_id':ID,'rule_id':ID,'rule_revision':INT,'company_id':ID,'company_revision':INT,'price_net':MONEY,'profit_net':nul(DEC),'score_value':nul(DEC),'score_status':_SCORE_STATUS,'anomaly_status':_ANOMALY_STATUS,'snapshot_sha256':st(64),'created_at':st(80)})
    S['ScenarioList']=obj({'items':arr(ref('ScenarioSummary'),0,100),'page':INT,'page_size':INT,'total':{'type':'integer','minimum':0}})
    S['ReportSummary']=obj({'id':ID,'scenario_id':ID,'scenario_name':st(200),'scope_id':ID,'decision':en('study','prepare','discard'),'created_at':st(80)})
    S['ReportList']=obj({'items':arr(ref('ReportSummary'),0,100),'page':INT,'page_size':INT,'total':{'type':'integer','minimum':0}})
    S['CompareRequest']=obj({'scenario_ids':arr(ID,2,3),'primary_id':ID})
    S['CompareContext']=obj({'tender_id':ID,'scope_id':ID,'budget_net':MONEY,'rule_id':ID,'rule_revision':INT,'company_id':ID,'company_revision':INT,'rivals_fingerprint':st(64),'rivals_count':{'type':'integer','minimum':0}})
    S['CompareEntry']=obj({'scenario_id':ID,'name':st(200),'discount_rate':DEC,'price_net':MONEY,'profit_net':nul(DEC),'score_value':nul(DEC),'score_status':_SCORE_STATUS,'anomaly_status':_ANOMALY_STATUS})
    S['CompareDelta']=obj({'base_id':ID,'other_id':ID,'delta_price_net':nul(DEC),'delta_price_motivo':nul(st(1000)),'delta_profit_net':nul(DEC),'delta_profit_motivo':nul(st(1000)),'delta_score':nul(DEC),'delta_score_motivo':nul(st(1000)),'cost_per_point_net':nul(DEC),'cost_per_point_motivo':nul(st(1000)),'dominant_id':nul(ID),'dominance_motivo':st(1000),'indicator':en('same_price_score','higher_profit_same_score','tradeoff','unknown','different_context'),'indicator_motivo':st(1000)})
    S['CompareResult']=obj({'status':en('comparable','no_comparable','partial'),'scenario_ids':arr(ID,2,3),'primary_id':ID,'context':ref('CompareContext'),'entries':arr(ref('CompareEntry'),2,3),'deltas':arr(ref('CompareDelta'),1,3),'warnings':arr(st(1000),0,30)})
    S['FrontierRequest']=obj({'scenario_ids':arr(ID,2,3)})
    S['FrontierEntry']=obj({'scenario_id':ID,'name':st(200),'verdict':en('en_frontera','dominada','excluida'),'motivo':st(1000),'profit_net':nul(DEC),'score_value':nul(DEC),'anomaly_status':_ANOMALY_STATUS})
    S['FrontierResult']=obj({'scenario_ids':arr(ID,2,3),'context':ref('CompareContext'),'entries':arr(ref('FrontierEntry'),2,3),'warnings':arr(st(1000),0,30)})
    S['PeriodMonths']={'type':'integer','minimum':1}
    S['StressHypothesisInput']=obj({'label':st1(80),'cost_net':MONEY,'period_months':ref('PeriodMonths'),'rival_a_net':MONEY,'rival_b_net':MONEY,'rival_set_complete':BOOL,'independent_groups_assumed':BOOL})
    S['StressConstraints']=obj({'min_price_points':DEC,'min_profit_net':MONEY})
    S['StressTestRequest']=obj({'pricing_rule_id':ID,'pricing_rule_revision':INT,'company_id':ID,'company_revision':INT,'candidate_discounts':arr(DEC,1,81),'hypotheses':arr(ref('StressHypothesisInput'),1,9),'constraints':ref('StressConstraints')})
    S['StressCell']=obj({'discount_rate':DEC,'hypothesis_label':st1(80),'price_net':nul(MONEY),'score':nul(DEC),'profit_net':nul(DEC),'feasible':BOOL,'reason':st(80)})
    S['StressByDiscount']=obj({'discount_rate':DEC,'price_net':nul(MONEY),'worst_score':nul(DEC),'worst_profit_net':nul(DEC),'max_cost_net':nul(MONEY),'all_feasible':BOOL,'comparable_count':{'type':'integer','minimum':0}})
    S['StressSelection']=obj({'discount_rate':DEC,'worst_profit_net':DEC,'worst_score':DEC,'feasible_count':INT})
    S['StressRuleRef']=obj({'id':ID,'revision':INT})
    S['StressCompanyRef']=obj({'id':ID,'base_revision':INT})
    S['StressHypothesisEcho']=obj({'label':st1(80)})
    S['StressTestResult']=obj({'id':ID,'scope_id':ID,'interpretation_revision':INT,'basis_sha256':st(64),'rule':ref('StressRuleRef'),'company':ref('StressCompanyRef'),'tested_candidates':INT,'tested_hypotheses':INT,'hypotheses_echo':arr(ref('StressHypothesisEcho'),1,9),'cells':arr(ref('StressCell'),1,729),'by_discount':arr(ref('StressByDiscount'),1,81),'selection':nul(ref('StressSelection')),'selection_reason':st(),'warnings':arr(st(1000),0,30),'created_at':st(80)})
    # O5: shared header parameters (path/query params stay inline: they vary per op).
    P={
     'XBidLabClient':{'name':'X-BidLab-Client','in':'header','required':True,'schema':en('local-ui'),'description':'Loopback client marker; every mutation requires local-ui plus a loopback Origin.','example':'local-ui'},
     'IdempotencyKey':{'name':'Idempotency-Key','in':'header','required':True,'schema':st(100),'description':'Caller-generated key (24h): same key+body replays the stored response, another body is 409.','example':'550e8400-e29b-41d4-a716-446655440000'},
     'IdempotencyKeyOptional':{'name':'Idempotency-Key','in':'header','required':False,'schema':st(100),'description':'Optional on reviews: when sent, replays deduplicate like other mutations.','example':'550e8400-e29b-41d4-a716-446655440000'},
    }
    # O4: shared error responses; every op $refs these instead of inline blocks.
    R={};_ERR_STATUS={'400':'BadRequest','403':'Forbidden','404':'NotFound','409':'Conflict','413':'PayloadTooLarge','415':'UnsupportedMedia','422':'UnprocessableEntity','429':'RateLimited','500':'InternalError','502':'BadGateway','503':'ServiceUnavailable'}
    for _code,_name in _ERR_STATUS.items():
        R[_name]={'description':'See Error.code for exact failure','content':{'application/json':{'schema':ref('Error')}}}
    # O3: minimal-but-valid examples. The conformance test validates each value
    # against its generated model, so every example below must satisfy the schema.
    _SHA64='9f2c4a1e'*8
    _SCENARIO_ID='9f2c4a1e0b3d4f5a8c7d6e5f4a3b2c1d'
    _TENDER={'raw_snapshot_sha256':_SHA64,'metadata_evidence':[],'id':'tias','source_id':'placsp:2026/00006554N','source_url':'https://contrataciondelestado.es/wps/portal/!ut/p/b0/','external_id':'2026/00006554N','title':'Servicio de limpieza (Tias, ejemplo curado)','contracting_body':'Ayuntamiento de Tias','cpv_codes':['79411000'],'status_raw':'ADJ','source_updated_at':'2026-01-01T00:00:00Z','deadline_literal':None,'deadline_at':None,'pbl_net':'118336.00','pbl_gross':'126619.52','estimated_value':'295840.00','scopes':[],'quality_flags':[]}
    _TENDER_LIST={'items':[_TENDER],'page':1,'page_size':20,'total':1}
    _TENDER_CREATE={'title':'Servicio de limpieza (expediente propio)','external_id':'2026/00009999X','contracting_body':'Ayuntamiento de Ejemplo','source_url':None,'scope_label':None,'basis':{'pbl_net':'118336.00','pbl_gross':None,'tax_kind':'IGIC','period_months':24,'currency':'EUR'}}
    _DOCUMENT_UPLOAD={'id':'doc-upload-001','tender_id':'tias','kind':'other','display_name':'pliego.pdf','sha256':_SHA64,'pages_count':2,'source_url':None,'rights_status':'unknown','parse_status':'ready'}
    _JOB={'id':'job-20261026-001','tender_id':'tias','status':'succeeded','stage':'done','processed_pages':6,'total_pages':6,'result_revision':2,'error_code':None,'warnings':[],'invocation_id':'inv-job-20261026-001-a1','mode':'fixture','model':None,'prompt_tokens':None,'completion_tokens':None,'estimated_cost_usd':None,'provider_request_id':None,'latency_ms':None}
    _ANALYSIS_REQ={'document_ids':['doc-tias-pcap'],'mode':'live','allow_remote_processing':False,'expected_interpretation_revision':1}
    _REVIEW_REQ={'expected_revision':1,'approved_claim_keys':['pbl_net'],'requirement_trees':[],'scope_basis':None,'pricing_rule':None,'corrected_proposal':None,'actor':'reviewer-1','reason':'Verified against the PCAP extracts.'}
    _COMPANY_WRITE={'name':'ACME S.L.','synthetic':True,'scope_id':'tias-whole','period_months':24,'direct_cost_net':'80000.00','overhead_net':'10000.00','target_margin_rate':'0.1000','evidence':[]}
    _COMPANY={'id':'company-demo','revision':1,**_COMPANY_WRITE}
    _COMPANY_UPDATE={'expected_revision':1,**_COMPANY_WRITE}
    _EVAL_REQ={'scope_id':'tias-whole','pricing_rule_id':'tias-price-r1','pricing_rule_revision':1,'company_id':'company-demo','company_revision':1,'discount_rate':'0.05','rivals':{'state':'assumed','complete':True,'group_membership_confirmed':True,'own_group_id':None,'offers':[{'label':'Rival A','price_net':'115000.00','group_id':None}]},'curve':None}
    _SCENARIO_ID_B='9f2c4a1e0b3d4f5a8c7d6e5f4a3b2c1e'
    _SCENARIO_SUMMARY={'id':_SCENARIO_ID,'name':'Baja 10%','scope_id':'tias-whole','rule_id':'tias-price-r1','rule_revision':1,'company_id':'company-demo','company_revision':1,'price_net':'106502.40','profit_net':'16502.40','score_value':'49.000000000000','score_status':'defined','anomaly_status':'not_flagged_under_assumptions','snapshot_sha256':_SHA64,'created_at':'2026-10-26T00:00:00Z'}
    _SCENARIO_LIST={'items':[_SCENARIO_SUMMARY],'page':1,'page_size':20,'total':1}
    _REPORT_SUMMARY={'id':_SCENARIO_ID,'scenario_id':_SCENARIO_ID,'scenario_name':'Baja 10%','scope_id':'tias-whole','decision':'study','created_at':'2026-10-26T00:00:00Z'}
    _REPORT_LIST={'items':[_REPORT_SUMMARY],'page':1,'page_size':20,'total':1}
    _COMPARE_REQ={'scenario_ids':[_SCENARIO_ID,_SCENARIO_ID_B],'primary_id':_SCENARIO_ID}
    _COMPARE_RES={'status':'comparable','scenario_ids':[_SCENARIO_ID,_SCENARIO_ID_B],'primary_id':_SCENARIO_ID,'context':{'tender_id':'tias','scope_id':'tias-whole','budget_net':'118336.00','rule_id':'tias-price-r1','rule_revision':1,'company_id':'company-demo','company_revision':1,'rivals_fingerprint':_SHA64,'rivals_count':2},'entries':[{'scenario_id':_SCENARIO_ID,'name':'Baja 15%','discount_rate':'0.1500','price_net':'100585.60','profit_net':'10585.60','score_value':'49.000000000000','score_status':'defined','anomaly_status':'not_flagged_under_assumptions'},{'scenario_id':_SCENARIO_ID_B,'name':'Baja 10%','discount_rate':'0.1000','price_net':'106502.40','profit_net':'16502.40','score_value':'49.000000000000','score_status':'defined','anomaly_status':'not_flagged_under_assumptions'}],'deltas':[{'base_id':_SCENARIO_ID,'other_id':_SCENARIO_ID_B,'delta_price_net':'5916.80','delta_price_motivo':None,'delta_profit_net':'5916.80','delta_profit_motivo':None,'delta_score':'0.000000000000','delta_score_motivo':None,'cost_per_point_net':None,'cost_per_point_motivo':'Sin incremento de puntos entre «Baja 15%» y «Baja 10%»: no se calcula el coste por punto.','dominant_id':_SCENARIO_ID_B,'dominance_motivo':'«Baja 10%» domina a «Baja 15%» en beneficio y puntos bajo este contexto.','indicator':'higher_profit_same_score','indicator_motivo':'«Baja 10%» conserva 5916.80 € más de beneficio estimado con la misma puntuación.'}],'warnings':[]}
    _FRONTIER_REQ={'scenario_ids':[_SCENARIO_ID,_SCENARIO_ID_B]}
    _FRONTIER_RES={'scenario_ids':[_SCENARIO_ID,_SCENARIO_ID_B],'context':{'tender_id':'tias','scope_id':'tias-whole','budget_net':'118336.00','rule_id':'tias-price-r1','rule_revision':1,'company_id':'company-demo','company_revision':1,'rivals_fingerprint':_SHA64,'rivals_count':2},'entries':[{'scenario_id':_SCENARIO_ID,'name':'Baja 15%','verdict':'dominada','motivo':'«Baja 15%» queda dominada por «Baja 10%»: menos beneficio y puntos en este caso.','profit_net':'10585.60','score_value':'49.000000000000','anomaly_status':'not_flagged_under_assumptions'},{'scenario_id':_SCENARIO_ID_B,'name':'Baja 10%','verdict':'en_frontera','motivo':'«Baja 10%» está en la frontera: ninguna otra prueba la supera en beneficio y puntos a la vez.','profit_net':'16502.40','score_value':'49.000000000000','anomaly_status':'not_flagged_under_assumptions'}],'warnings':[]}
    _STRESS_REQ={'pricing_rule_id':'tias-price-r1','pricing_rule_revision':1,'company_id':'company-demo','company_revision':1,'candidate_discounts':['0.05','0.12','0.20'],'hypotheses':[{'label':'Base','cost_net':'80000.00','period_months':24,'rival_a_net':'106502.40','rival_b_net':'112419.20','rival_set_complete':True,'independent_groups_assumed':True}],'constraints':{'min_price_points':'47','min_profit_net':'8000.00'}}
    _STRESS_RES={'id':'a1b2c3d4e5f60718293a4b5c6d7e8f90','scope_id':'tias-whole','interpretation_revision':1,'basis_sha256':_SHA64,'rule':{'id':'tias-price-r1','revision':1},'company':{'id':'company-demo','base_revision':1},'tested_candidates':3,'tested_hypotheses':1,'hypotheses_echo':[{'label':'Base'}],'cells':[{'discount_rate':'0.05','hypothesis_label':'Base','price_net':'112419.20','score':'46.400000000000','profit_net':'32419.20','feasible':False,'reason':'below_limits'},{'discount_rate':'0.12','hypothesis_label':'Base','price_net':'104135.68','score':'49.000000000000','profit_net':'24135.68','feasible':True,'reason':'meets_limits'},{'discount_rate':'0.20','hypothesis_label':'Base','price_net':'94668.80','score':'49.000000000000','profit_net':'14668.80','feasible':True,'reason':'meets_limits'}],'by_discount':[{'discount_rate':'0.05','price_net':'112419.20','worst_score':'46.400000000000','worst_profit_net':'32419.20','max_cost_net':'104419.20','all_feasible':False,'comparable_count':1},{'discount_rate':'0.12','price_net':'104135.68','worst_score':'49.000000000000','worst_profit_net':'24135.68','max_cost_net':'96135.68','all_feasible':True,'comparable_count':1},{'discount_rate':'0.20','price_net':'94668.80','worst_score':'49.000000000000','worst_profit_net':'14668.80','max_cost_net':'86668.80','all_feasible':True,'comparable_count':1}],'selection':{'discount_rate':'0.12','worst_profit_net':'24135.68','worst_score':'49.000000000000','feasible_count':2},'selection_reason':'maximize worst profit among feasible tested discounts','warnings':[],'created_at':'2026-10-26T00:00:00Z'}
    paths={}
    _PATH_EXAMPLES={'tender_id':'tias','document_id':'doc-tias-pcap','page_number':6,'company_id':'company-demo','job_id':'job-20261026-001','scenario_id':_SCENARIO_ID,'report_id':_SCENARIO_ID,'scope_id':'tias-whole','stress_id':'a1b2c3d4e5f60718293a4b5c6d7e8f90'}
    def add(path,method,operation,response,body=None,status='200',params=None,content='application/json',description=None,summary=None,tags=None,request_example=None,response_example=None):
        assert summary and description, f'{operation}: O3 requires summary+description'
        assert '{' in path or params or request_example is not None or response_example is not None, f'{operation}: O3 requires at least one example'
        parameters=[]
        for piece in path.split('/'):
            if piece.startswith('{'):
                name=piece[1:-1]
                parameters.append(param(name,'path',INT if piece=='{page_number}' else ID,True,_PATH_EXAMPLES.get(name)))
        if method in ['post','put','patch','delete']:
            parameters.append(par('XBidLabClient'))
        if method=='post' and path.endswith(('/analysis','/scenarios','/reports','/demo/sessions','/tenders')):
            parameters.append(par('IdempotencyKey'))
        parameters+=(params or [])
        responses={status:{'description':'Successful response','content':{content:{'schema':ref(response) if response in S else ({'type':'string','format':'binary'} if content=='application/pdf' else {'type':'string'})}}}}
        if response_example is not None:
            responses[status]['content'][content]['examples']=_example(operation,response_example)
        if status=='202':responses[status]['headers']={'Location':{'schema':st(300),'description':'Local job resource URL'}}
        for code in _ERR_STATUS:
            responses[code]=resp(_ERR_STATUS[code])
        op={'operationId':operation,'summary':summary,'description':description,'responses':responses}
        if tags:op['tags']=tags
        if parameters:op['parameters']=parameters
        if body:
            op['requestBody']={'required':True,'content':{'application/json':{'schema':ref(body)}}}
            if request_example is not None:
                op['requestBody']['content']['application/json']['examples']=_example(operation,request_example)
        paths.setdefault(path,{})[method]=op
    add('/api/v1/health','get','health','Health',summary='Liveness probe',description='Returns ok with engine/schema versions. Never touches Meta billing or the database.',tags=['health'],response_example={'status':'ok','engine_version':'1.0.0','schema_version':'1.0.0'})
    add('/api/v1/ready','get','readiness','Ready',summary='Readiness probe',description='Liveness plus a SQLite PRAGMA quick_check; reports degraded with status 503 when the database is unhealthy.',tags=['health'],response_example={'status':'ready','db_quick_check':'ok'})
    # Readiness 503 carries a Ready body (not an Error envelope): the probe result itself is the payload.
    paths['/api/v1/ready']['get']['responses']['503']={'description':'Database degraded; same Ready shape as the 200 body.','content':{'application/json':{'schema':ref('Ready'),'examples':_example('readiness',{'status':'degraded','db_quick_check':'integrity check failed'})}}}
    add('/api/v1/capabilities','get','capabilities','Capabilities',summary='Effective capabilities',description='Mode, Meta configuration (never the key), history flag, hard limits and limitation notes.',tags=['capabilities'],response_example={'mode':'demo','meta_configured':False,'meta_model':'muse-spark-1.3','history_enabled':False,'limits':{'pdf_bytes':20971520,'pdf_pages':120,'curve_points':201},'limitations':['curated_demo: figures come from the reviewed seed, not live extraction','history_disabled']})
    add('/api/v1/demo/sessions','post','create_demo_session','DemoSession',status='201',summary='Create demo session',description='Ensures the curated seed exists on an empty database and returns its tender, scope and company ids. Idempotent via Idempotency-Key.',tags=['tenders'],response_example={'tender_id':'tias','scope_id':'tias-whole','company_id':'company-demo','mode':'demo'})
    add('/api/v1/tenders','get','list_tenders','TenderList',params=[param('q','query',st(200),example='Tias'),param('cpv','query',st(12),example='79411000'),param('page','query',{'type':'integer','minimum':1,'default':1},example=1),param('page_size','query',{'type':'integer','minimum':1,'maximum':100,'default':20},example=20)],summary='List tenders',description='Curated library search with q/cpv filters and page/page_size pagination.',tags=['tenders'],response_example=_TENDER_LIST)
    add('/api/v1/tenders','post','create_tender','Tender','TenderCreate',status='201',summary='Create own tender',description='Manual intake: creates an own tender with an initial scope from the supplied fields only. Never fetches remote data and never infers tax from a single amount. Idempotent via Idempotency-Key.',tags=['tenders'],request_example=_TENDER_CREATE,response_example=_TENDER)
    # Intake upload is multipart (file + kind), so it bypasses add() (JSON only).
    _upload_responses={'201':{'description':'Successful response','content':{'application/json':{'schema':ref('Document'),'examples':_example('upload_tender_document',_DOCUMENT_UPLOAD)}}}}
    for _code,_name in _ERR_STATUS.items():
        _upload_responses[_code]=resp(_name)
    paths['/api/v1/tenders/{tender_id}/documents']={'post':{'operationId':'upload_tender_document','summary':'Upload tender document','description':'Attach a user-supplied local PDF to an own tender. Validates magic bytes, size and readability before storing; failures keep the tender intact. Idempotent via Idempotency-Key over the file bytes plus kind.','tags':['documents'],'parameters':[param('tender_id','path',ID,True,'tias'),par('XBidLabClient'),par('IdempotencyKey')],'requestBody':{'required':True,'content':{'multipart/form-data':{'schema':{'type':'object','properties':{'file':{'type':'string','format':'binary','description':'PDF bytes; type, size and limits are validated server-side.'},'kind':{'type':'string','enum':['pcap','ppt','other'],'default':'other','description':'Document kind; defaults to other.'}},'required':['file'],'additionalProperties':False}}}},'responses':_upload_responses}}
    add('/api/v1/tenders/{tender_id}','get','get_tender','Tender',summary='Get tender',description='Single tender header with scopes and price bases.',tags=['tenders'],response_example=_TENDER)
    add('/api/v1/tenders/{tender_id}/workspace','get','get_workspace','Workspace',summary='Get workspace',description='Full working set: tender, interpretation revision, documents, claims, requirements, citations and pricing rules.',tags=['tenders'])
    add('/api/v1/documents/{document_id}/pages/{page_number}','get','get_page','PageText',summary='Get page text',description='Curated page extract: raw and normalized text, hash and extractor version.',tags=['documents'],response_example={'document_id':'doc-tias-pcap','page_number':6,'printed_label':'6','raw_text':'Precio neto 207.088,00 euros','normalized_text':'Precio neto 207.088,00 euros','text_sha256':_SHA64,'extractor_version':'bidlab-pdf-1','quality_flags':[]})
    add('/api/v1/documents/{document_id}/pages/{page_number}/image','get','get_page_image','binary',content='image/png',summary='Get page image',description='Exact rendered PNG of one physical page (versioned render, SHA-verified); 404 when the document was never rendered (use the curated page text).',tags=['documents'])
    add('/api/v1/documents/{document_id}/content','get','get_document_content','binary',content='application/pdf',summary='Get document bytes',description='Original PDF when redistribution is allowed; otherwise 404 document_bytes_unavailable (use source_url and curated excerpts).',tags=['documents'])
    add('/api/v1/tenders/{tender_id}/analysis','post','start_analysis','Job','AnalysisRequest',status='202',summary='Start analysis job',description='Queue extraction over curated pages; poll with get_job. The Location header points at the job resource.',tags=['jobs'],request_example=_ANALYSIS_REQ,response_example=_JOB)
    add('/api/v1/jobs/{job_id}','get','get_job','Job',summary='Get job',description='Poll analysis job state and outcome.',tags=['jobs'],response_example=_JOB)
    add('/api/v1/tenders/{tender_id}/reviews','post','review_interpretation','Workspace','ReviewRequest',params=[par('IdempotencyKeyOptional')],summary='Review interpretation',description='Approve claim keys and requirement trees (or submit a corrected proposal); returns the new Workspace revision. Idempotency-Key is optional here.',tags=['review'],request_example=_REVIEW_REQ)
    add('/api/v1/companies','post','create_company','Company','CompanyWrite',status='201',summary='Create company',description='Company profile revision 1: synthetic demo costs or user attestation with evidence.',tags=['companies'],request_example=_COMPANY_WRITE,response_example=_COMPANY)
    add('/api/v1/companies/{company_id}','get','get_company','Company',summary='Get company',description='Latest revision of a company profile.',tags=['companies'],response_example=_COMPANY)
    add('/api/v1/companies/{company_id}','put','update_company','Company','CompanyUpdate',summary='Update company',description='Appends a revision when expected_revision matches latest; 409 stale_revision otherwise.',tags=['companies'],request_example=_COMPANY_UPDATE,response_example=_COMPANY)
    add('/api/v1/eligibility/check','post','check_eligibility','EligibilityResult','EligibilityRequest',summary='Check eligibility',description='Pure three-valued evaluation of the requirements tree against one pinned company revision; nothing is persisted.',tags=['companies'],request_example={'tender_id':'tias','scope_id':'tias-whole','company_id':'company-demo','company_revision':1,'interpretation_revision':1},response_example={'verdict':'unknown','items':[{'requirement_id':'req-fin-1','verdict':'unknown','reason_codes':['missing_company_evidence'],'evidence_refs':[]}],'assessed_count':0,'unassessed_count':1,'hypothetical_company':True})
    add('/api/v1/scenarios/evaluate','post','evaluate_scenario','EvaluationResult','EvaluationRequest',summary='Evaluate scenario',description='Pure pricing computation: price, profit, score, anomaly, trace and optional curve. Nothing is persisted.',tags=['scenarios'],request_example=_EVAL_REQ)
    add('/api/v1/scenarios','post','save_scenario','Scenario','ScenarioCreate',status='201',summary='Save scenario',description='Replays the input through the pure evaluator and persists an integrity-hashed snapshot with frozen context.',tags=['scenarios'],request_example={'name':'Base 5%','input':_EVAL_REQ})
    add('/api/v1/scenarios/{scenario_id}','get','get_scenario','Scenario',summary='Get scenario',description='Saved snapshot with input, result and frozen context.',tags=['scenarios'])
    _PAGE=[param('page','query',{'type':'integer','minimum':1,'default':1},example=1),param('page_size','query',{'type':'integer','minimum':1,'maximum':100,'default':20},example=20)]
    add('/api/v1/tenders/{tender_id}/scenarios','get','list_tender_scenarios','ScenarioList',params=[param('scope_id','query',ID,example='tias-whole'),*_PAGE],summary='List tender scenarios',description='Light scenario items for one tender without full snapshots; optional scope_id filter with page/page_size pagination.',tags=['scenarios'],response_example=_SCENARIO_LIST)
    add('/api/v1/tenders/{tender_id}/reports','get','list_tender_reports','ReportList',params=[param('scope_id','query',ID,example='tias-whole'),*_PAGE],summary='List tender reports',description='Light report items for one tender; optional scope_id filter with page/page_size pagination.',tags=['reports'],response_example=_REPORT_LIST)
    add('/api/v1/scenarios/compare','post','compare_scenarios','CompareResult','CompareRequest',summary='Compare scenarios',description='Typed comparison of 2-3 saved scenarios: shared-context check, Decimal deltas, dominance and indicators with Spanish motivos. Pure computation over frozen snapshots; nothing is persisted.',tags=['scenarios'],request_example=_COMPARE_REQ,response_example=_COMPARE_RES)
    add('/api/v1/scenarios/frontier','post','decision_frontier','FrontierResult','FrontierRequest',summary='Pareto frontier',description='Pareto classification of 2-3 saved scenarios over frozen economics (Decimal, pure). Requires one shared context (422 frontier_not_comparable otherwise); unknown figures and anomaly-flagged scenarios are excluded with a motivo. Nothing is persisted.',tags=['scenarios'],request_example=_FRONTIER_REQ,response_example=_FRONTIER_RES)
    add('/api/v1/reports','post','create_report','Report','ReportCreate',status='201',summary='Create report',description='Decision record over an immutable scenario, plus printable HTML with sources.',tags=['reports'],request_example={'scenario_id':_SCENARIO_ID,'decision':'study','note':'Numbers hold at 5%; confirm team capacity before preparing the bid.'})
    add('/api/v1/reports/{report_id}','get','get_report','Report',summary='Get report',description='Decision record with its scenario snapshot and pending items.',tags=['reports'])
    add('/api/v1/reports/{report_id}/html','get','get_report_html','html',content='text/html',summary='Get report HTML',description='Printable decision record (text/html served with CSP and nosniff).',tags=['reports'])
    add('/api/v1/scopes/{scope_id}/stress-tests','post','run_stress_test','StressTestResult','StressTestRequest',summary='Run stress mesh',description='Declared discount grid by rival hypotheses over the deterministic evaluator with frozen context. Persists an integrity-hashed snapshot; unknown cells never enter the selection and anomaly only warns.',tags=['stress'],request_example=_STRESS_REQ,response_example=_STRESS_RES)
    add('/api/v1/stress-tests/{stress_id}','get','get_stress_test','StressTestResult',summary='Get stress test',description='Integrity-checked stress snapshot by id; 404 stress_not_found when absent, 500 snapshot_corrupt on hash mismatch.',tags=['stress'],response_example=_STRESS_RES)
    spec={'openapi':'3.1.0','info':{'title':'BidLab local API','version':'1.0.0','description':'Design contract, not a deployed API. Decimal values are strings. Rules must be reviewed. Loopback only; mutations require same-origin validation and X-BidLab-Client.'},'servers':[{'url':'http://127.0.0.1:8000'}],'paths':paths,'components':{'schemas':S,'parameters':P,'responses':R}}
    spec=json.loads(json.dumps(spec))  # distinct objects per use: no YAML anchors
    return spec,S
def write_extraction_schema(S):
    """Standalone extraction schema, refs resolved into definitions for offline validation."""
    schema=copy.deepcopy(S['ExtractionProposal']);schema['$schema']='https://json-schema.org/draft/2020-12/schema'
    schema['$defs']=copy.deepcopy(S)
    _rewrite_refs(schema)
    # Include the transitive extraction closure (base proposals plus whatever they
    # $ref, e.g. shared Decimal/EntityId), keeping provider input schema small.
    needed={'ClaimProposal','CitationProposal','RequirementProposal','FormulaProposal'}
    while True:
        probe=json.dumps({k:v for k,v in schema.items() if k!='$defs'})
        probe+=json.dumps({k:schema['$defs'][k] for k in needed if k in schema['$defs']})
        found=set(re.findall(r'#/\$defs/([A-Za-z0-9_]+)',probe))
        if found<=needed:break
        needed|=found
    schema['$defs']={k:v for k,v in schema['$defs'].items() if k in needed}
    (ROOT/'schemas/extraction.schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf-8')
def main():
    import yaml
    spec,S=build_spec()
    (ROOT/'docs/API_CONTRACT.yaml').write_text(yaml.safe_dump(spec,sort_keys=False,allow_unicode=True),encoding='utf-8')
    write_extraction_schema(S)
    paths=spec['paths']
    print('Wrote OpenAPI',len(paths),'paths;',sum(len(v) for v in paths.values()),'operations;',len(S),'schemas')
if __name__=='__main__':
    main()
