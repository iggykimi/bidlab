"""Research-only public-source download probe; no app, secrets or API calls."""
import argparse, concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

def fetch(item, root, limit):
    key, url = item
    stamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "BidLab-feasibility/0.1 (small public-data research probe)"})
        with urllib.request.urlopen(req, timeout=35) as r:
            data = r.read(limit + 1)
            if len(data) > limit:
                raise ValueError("size limit exceeded")
            path = root / key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return dict(key=key, url=url, final_url=r.url, status=r.status,
                        content_type=r.headers.get("Content-Type"), bytes=len(data),
                        sha256=hashlib.sha256(data).hexdigest(), retrieved_at=stamp,
                        etag=r.headers.get("ETag"), last_modified=r.headers.get("Last-Modified"))
    except Exception as e:
        return dict(key=key, url=url, retrieved_at=stamp, error=f"{type(e).__name__}: {e}")

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("manifest", type=pathlib.Path)
    p.add_argument("--root", type=pathlib.Path, default=pathlib.Path("research/raw"))
    p.add_argument("--max-mib", type=int, default=80)
    a = p.parse_args()
    items = list(json.loads(a.manifest.read_text()).items())
    a.root.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda i: fetch(i, a.root, a.max_mib*1024*1024), items))
    output = a.root / (a.manifest.stem + "_results.json")
    output.write_text(json.dumps(results, ensure_ascii=False, indent=2))
    for x in results:
        print(x["key"], x.get("status", "ERROR"), x.get("bytes", x.get("error")), flush=True)
