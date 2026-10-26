PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE tender (
 id TEXT PRIMARY KEY, feed_id TEXT NOT NULL, atom_id TEXT NOT NULL,
 external_id TEXT NOT NULL, title TEXT NOT NULL, source_url TEXT NOT NULL,
 source_updated_at TEXT NOT NULL, metadata_json TEXT NOT NULL CHECK(json_valid(metadata_json)),
 UNIQUE(feed_id,atom_id)
);
CREATE TABLE notice_version (
 id TEXT PRIMARY KEY, tender_id TEXT NOT NULL REFERENCES tender(id),
 updated_utc TEXT NOT NULL, raw_sha256 TEXT NOT NULL, blob_path TEXT NOT NULL,
 retrieved_at TEXT NOT NULL, source_url TEXT NOT NULL, tombstone INTEGER NOT NULL DEFAULT 0 CHECK(tombstone IN(0,1)),
 UNIQUE(tender_id,updated_utc,raw_sha256)
);
CREATE TABLE scope (
 id TEXT PRIMARY KEY, tender_id TEXT NOT NULL REFERENCES tender(id), lot_key TEXT NOT NULL,
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)),
 budget_net_cents INTEGER CHECK(budget_net_cents>=0), UNIQUE(tender_id,lot_key)
);
CREATE TABLE document (
 id TEXT PRIMARY KEY, tender_id TEXT NOT NULL REFERENCES tender(id), kind TEXT NOT NULL,
 sha256 TEXT NOT NULL, blob_path TEXT NOT NULL, display_name TEXT NOT NULL,
 pages_count INTEGER NOT NULL CHECK(pages_count BETWEEN 1 AND 120),
 source_url TEXT, rights_status TEXT NOT NULL, parse_status TEXT NOT NULL,
 UNIQUE(tender_id,sha256,kind)
);
CREATE TABLE document_page (
 document_id TEXT NOT NULL REFERENCES document(id), page_number INTEGER NOT NULL CHECK(page_number>=1),
 raw_text TEXT NOT NULL, normalized_text TEXT NOT NULL, text_sha256 TEXT NOT NULL,
 extractor_version TEXT NOT NULL, flags_json TEXT NOT NULL CHECK(json_valid(flags_json)),
 PRIMARY KEY(document_id,page_number)
);
CREATE TABLE citation (
 id TEXT PRIMARY KEY, document_id TEXT NOT NULL, page_number INTEGER NOT NULL,
 document_sha256 TEXT NOT NULL, quote TEXT NOT NULL, match_status TEXT NOT NULL,
 normalized_start INTEGER, normalized_end INTEGER, normalization_version TEXT NOT NULL,
 FOREIGN KEY(document_id,page_number) REFERENCES document_page(document_id,page_number)
);
CREATE TABLE interpretation_revision (
 tender_id TEXT NOT NULL REFERENCES tender(id), revision INTEGER NOT NULL CHECK(revision>=1),
 mode TEXT NOT NULL CHECK(mode IN('live','fixture','manual')),
 proposal_json TEXT NOT NULL CHECK(json_valid(proposal_json)),
 reviewed_json TEXT NOT NULL CHECK(json_valid(reviewed_json)),
 document_hashes_json TEXT NOT NULL CHECK(json_valid(document_hashes_json)),
 actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(tender_id,revision)
);
CREATE TABLE rule_revision (
 rule_id TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision>=1),
 scope_id TEXT NOT NULL REFERENCES scope(id), interpretation_revision INTEGER NOT NULL,
 rule_json TEXT NOT NULL CHECK(json_valid(rule_json)), review_status TEXT NOT NULL,
 actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(rule_id,revision)
);
CREATE TABLE company (
 id TEXT PRIMARY KEY, created_at TEXT NOT NULL
);
CREATE TABLE company_revision (
 company_id TEXT NOT NULL REFERENCES company(id), revision INTEGER NOT NULL CHECK(revision>=1),
 scope_id TEXT NOT NULL REFERENCES scope(id), direct_cost_cents INTEGER CHECK(direct_cost_cents>=0),
 overhead_cents INTEGER CHECK(overhead_cents>=0),
 profile_json TEXT NOT NULL CHECK(json_valid(profile_json)), created_at TEXT NOT NULL,
 PRIMARY KEY(company_id,revision)
);
CREATE TABLE historical_award (
 id TEXT PRIMARY KEY, notice_version_id TEXT NOT NULL REFERENCES notice_version(id),
 scope_id TEXT REFERENCES scope(id), result_index INTEGER NOT NULL CHECK(result_index>=0),
 budget_net_cents INTEGER, award_net_cents INTEGER, award_date TEXT,
 comparability TEXT NOT NULL CHECK(comparability IN('unreviewed','comparable','excluded')),
 basis_json TEXT NOT NULL CHECK(json_valid(basis_json)), flags_json TEXT NOT NULL CHECK(json_valid(flags_json)),
 reviewer TEXT, UNIQUE(notice_version_id,result_index)
);
CREATE TABLE scenario (
 id TEXT PRIMARY KEY, scope_id TEXT NOT NULL REFERENCES scope(id),
 rule_id TEXT NOT NULL, rule_revision INTEGER NOT NULL,
 company_id TEXT NOT NULL, company_revision INTEGER NOT NULL,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), snapshot_sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL,
 FOREIGN KEY(rule_id,rule_revision) REFERENCES rule_revision(rule_id,revision),
 FOREIGN KEY(company_id,company_revision) REFERENCES company_revision(company_id,revision)
);
CREATE TABLE report (
 id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenario(id),
 report_json TEXT NOT NULL CHECK(json_valid(report_json)), created_at TEXT NOT NULL
);
CREATE TABLE job (
 id TEXT PRIMARY KEY, tender_id TEXT NOT NULL REFERENCES tender(id),
 status TEXT NOT NULL CHECK(status IN('queued','running','succeeded','needs_review','failed','cancelled')),
 request_json TEXT NOT NULL CHECK(json_valid(request_json)), stage TEXT NOT NULL,
 worker_id TEXT, lease_until TEXT, result_revision INTEGER, error_code TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE model_invocation (
 id TEXT PRIMARY KEY, job_id TEXT REFERENCES job(id),
 mode TEXT NOT NULL CHECK(mode IN('live','fixture','manual')), model TEXT,
 prompt_version TEXT NOT NULL, input_hash TEXT NOT NULL, provider_request_id TEXT,
 prompt_tokens INTEGER CHECK(prompt_tokens>=0), completion_tokens INTEGER CHECK(completion_tokens>=0),
 cached_tokens INTEGER CHECK(cached_tokens>=0), estimated_cost_usd TEXT,
 latency_ms INTEGER, status TEXT NOT NULL, created_at TEXT NOT NULL,
 CHECK(mode='live' OR (prompt_tokens IS NULL AND completion_tokens IS NULL AND cached_tokens IS NULL))
);
CREATE TABLE audit_event (
 id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
 actor TEXT NOT NULL, reason TEXT NOT NULL, old_json TEXT, new_json TEXT NOT NULL CHECK(json_valid(new_json)),
 created_at TEXT NOT NULL
);
CREATE TABLE idempotency_record (
 route TEXT NOT NULL, idempotency_key TEXT NOT NULL, body_sha256 TEXT NOT NULL,
 response_json TEXT NOT NULL CHECK(json_valid(response_json)), expires_at TEXT NOT NULL,
 PRIMARY KEY(route,idempotency_key)
);
CREATE INDEX ix_versions_latest ON notice_version(tender_id,updated_utc DESC);
CREATE INDEX ix_jobs_queue ON job(status,created_at);
CREATE INDEX ix_awards_scope_date ON historical_award(scope_id,award_date);
