"""Opt-in real Meta Model API smoke. Never manufactures provider results."""
import argparse, datetime, json, os, pathlib, sys, time, urllib.error, urllib.request

def main():
    p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path);a=p.parse_args()
    result={'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'executed_inference':False,'model':os.environ.get('META_MODEL','muse-spark-1.3')}
    key=os.environ.get('MODEL_API_KEY')
    if not key:
        result.update(status='BLOCKED',reason='MODEL_API_KEY not set; no request sent')
        code=2
    else:
        schema={'type':'object','properties':{'ready':{'type':'boolean'}},'required':['ready'],'additionalProperties':False}
        body={'model':result['model'],'messages':[{'role':'user','content':'Return ready=true as JSON.'}],
              'max_completion_tokens':1024,
              'response_format':{'type':'json_schema','json_schema':{'name':'bidlab_smoke','schema':schema}}}
        req=urllib.request.Request('https://api.meta.ai/v1/chat/completions',data=json.dumps(body).encode(),
                                  headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'},method='POST')
        start=time.monotonic()
        try:
            with urllib.request.urlopen(req,timeout=90) as response:
                payload=json.loads(response.read(2*1024*1024))
                choice=payload['choices'][0];content=json.loads(choice['message']['content'])
                if choice.get('finish_reason')!='stop' or content!={'ready':True}:
                    raise ValueError('unexpected finish reason or structured content')
                result.update(status='PASS',executed_inference=True,http_status=response.status,
                              returned_model=payload.get('model'),usage=payload.get('usage'),
                              provider_request_id=response.headers.get('x-request-id'))
                code=0
        except urllib.error.HTTPError as e:
            result.update(status='FAIL',http_status=e.code,reason='Provider HTTP error; response body suppressed')
            code=1
        except Exception as e:
            result.update(status='FAIL',reason=type(e).__name__+'; no successful inference recorded')
            code=1
        result['elapsed_ms']=round((time.monotonic()-start)*1000)
    serialized=json.dumps(result,indent=2)
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(serialized)
    print(serialized);return code
if __name__=='__main__':sys.exit(main())
