import re, json, sys, pdfplumber
from collections import Counter
PDF, P1, P2, MAT, OUT = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
TYPES = {'savoirs':'savoir','savoir':'savoir','savoir-faire':'savoir-faire','compétence':'compétence','compétences':'compétence'}
LEV = re.compile(r'^(P[1-6]|S[1-6])$')
clean = lambda s: re.sub(r'\s+',' ',(s or '').replace('\n',' ')).replace(' .','.').replace(' ;',';').strip()
def split_attendus(cell):
    out=[]
    for ln in (cell or '').split('\n'):
        ln=ln.strip()
        if not ln: continue
        if re.match(r'^Ex\s*[.:]',ln):
            if out: out[-1]['ex']=clean(ln)
            continue
        cont = out and (ln.startswith(('-','•')) or not re.match(r'^[A-ZÉÈÀÂÊÎÔÛÇ]',ln) or out[-1]['t'].rstrip().endswith((':',',',';','-',' de',' des',' la',' le',' les','à','à l’','d’','l’')))
        if cont: out[-1]['t']+=' '+ln
        else: out.append({'t':ln})
    return out
res=[]; niv=None; typ=None; theme=''; sous=''; rub=''; last_item=''
with pdfplumber.open(PDF) as pdf:
    for pn in range(P1,P2+1):
        page=pdf.pages[pn-1]; W=page.width
        words=page.extract_words()
        lv=[w['text'] for w in words if LEV.match(w['text']) and w['x0']<W*0.12 and w['top']>60]
        if lv: niv=lv[0]
        # thèmes avec leur position verticale
        themes=[]
        for ln in page.extract_text_lines():
            m=re.match(r'^(\d\.\d+\.)\s+(\S.*)$',ln['text'].strip())
            if m and ln['x0']<W*0.25: themes.append((ln['top'],f'{m.group(1)} {m.group(2)}'))
        tables=page.find_tables()
        for t in tables:
            rows=t.extract()
            top=t.bbox[1]
            # thème = dernier titre situé au-dessus de la table (sinon thème courant)
            above=[th for (tp,th) in themes if tp<=top+2]
            if above: theme=above[-1]
            # lignes : repérer la position verticale de chaque ligne pour affecter le bon thème
            for ri,row in enumerate(rows):
                if len(row) not in (2,3): continue
                a,b=row[0] or '',row[-1] or ''
                mid=clean(row[1]) if len(row)==3 else ''
                h=clean(a).lower()
                mh=re.match(r'^(savoir-faire|savoirs?|compétences?)\b\s*(.*)$',h)
                if mh and clean(b).lower().startswith('attendu'):
                    typ=TYPES[mh.group(1)]; sous=clean(a)[len(mh.group(1)):].strip(' :'); rub=''; last_item=''; continue
                if typ is None: continue
                if len(row)==3 and clean(a) and not clean(b) and not mid:
                    rub=clean(a); continue
                if not clean(b): continue
                if clean(a): last_item=clean(a)
                rtop=t.rows[ri].bbox[1] if ri<len(t.rows) else top
                above=[th for (tp,th) in themes if tp<=rtop+2]
                cur=above[-1] if above else theme
                for x in split_attendus(b):
                    d={'matiere':MAT,'niveau':niv,'theme':cur,'type':typ,'sous':sous,'rubrique':rub,'item':last_item,'attendu':clean(x['t']),'page':pn}
                    if mid: d['capacite']=mid
                    if 'ex' in x: d['exemple']=x['ex']
                    res.append(d)
                theme=cur
json.dump(res,open(OUT,'w'),ensure_ascii=False,indent=1)
print(len(res),'attendus')
print(dict(Counter(r['niveau'] for r in res)))
print(dict(Counter(r['type'] for r in res)))
