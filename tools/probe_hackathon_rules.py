"""Recover the public rules document delivered in official HTML, without executing JS.

Usage: python tools/probe_hackathon_rules.py waiver.html --out private_rules.txt
Keep the recovered legal text private; cite the official page in public documentation.
"""
import argparse, hashlib, json, pathlib
from lxml import html

def recover(path):
    chunks=[]
    for text in html.parse(str(path)).xpath('//script[not(@src)]/text()'):
        prefix='self.__next_f.push('
        if not text.startswith(prefix):continue
        try:
            item=json.loads(text[len(prefix):-1])
            if len(item)>1 and isinstance(item[1],str):chunks.append(item[1])
        except (ValueError,TypeError):continue
    serialized=''.join(chunks);heading=serialized.find('Hackathon Terms')
    if heading<0:raise ValueError('Official rules heading not found; page may have changed')
    start=serialized.rfind('{"type":"doc"',0,heading)
    if start<0:raise ValueError('Document container not found')
    document,_=json.JSONDecoder().raw_decode(serialized[start:])
    def walk(node):
        if node.get('type')=='text':return node.get('text','')
        body=''.join(walk(c) for c in node.get('content',[]))
        return body+('\n' if node.get('type') in ['paragraph','heading','listItem'] else '')
    return walk(document)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('input',type=pathlib.Path);p.add_argument('--out',type=pathlib.Path,required=True);a=p.parse_args()
    text=recover(a.input);a.out.write_text(text)
    print(json.dumps({'recovered':True,'characters':len(text),'sha256':hashlib.sha256(text.encode()).hexdigest()},indent=2))
