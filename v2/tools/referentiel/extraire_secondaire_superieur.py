import pdfplumber, re, json, sys
from collections import Counter
PDF, MAT, FORME, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
clean=lambda s: re.sub(r'\s+',' ',s).replace(' .','.').strip()
def lines(words,tol=3):
    rows=[]
    for w in sorted(words,key=lambda w:(round(w['top']),w['x0'])):
        if rows and abs(rows[-1][0]-w['top'])<=tol: rows[-1][1].append(w)
        else: rows.append([w['top'],[w]])
    return [(t,' '.join(x['text'] for x in sorted(ws,key=lambda x:x['x0'])),min(x['x0'] for x in ws)) for t,ws in rows]
BUL=re.compile(r'^[\uf0b7\uf0a7\u2022\u25aa\uf0d8•▪–-]\s*')
def items(ls):
    if not ls: return []
    out=[]; ctx=''
    has=any(BUL.match(tx) for _,tx,_ in ls)
    for t,txt,x0 in ls:
        if has:
            if BUL.match(txt): out.append({'t':BUL.sub('',txt),'ctx':ctx})
            elif out: out[-1]['t']+=' '+txt
            else: ctx=txt
        else:
            if out and not re.match(r'^[A-ZÉÈÀ]',txt): out[-1]['t']+=' '+txt
            else: out.append({'t':txt,'ctx':''})
    return [clean(o['t']) if not o['ctx'] else clean(o['ctx']+' : '+o['t']) for o in out]
res=[]
with pdfplumber.open(PDF) as pdf:
    for pn,p in enumerate(pdf.pages,1):
        txt=p.extract_text() or ''
        m=re.search(r'(\d[A-Z]?)\s*UAA\s*(\d+)',txt)
        if not m or 'Compétences à développer' not in txt: continue
        W=p.width; words=p.extract_words()
        head=next((l for l in txt.split('\n') if 'degré' in l and ('année' in l)),'')
        uaa=f'{m.group(1)}UAA{m.group(2)}'
        titre=''
        mt=re.search(r"Unité d’acquis d’apprentissage\s+(.+)",txt); 
        if mt: titre=clean(mt.group(1))
        ls=lines(words)
        # compétences à développer : lignes en MAJUSCULES entre « Compétences à développer » et « Processus »
        comp=[];on=False
        for t,tx,x0 in ls:
            if 'Compétences à développer' in tx: on=True; continue
            if tx.startswith('Processus') or 'Processus' in tx.split()[:1]: break
            if on and tx.isupper(): comp.append(tx)
        pr=next((w for w in words if w['text']=='Processus'),None)
        if not pr: continue
        top=pr['top']+10
        ap=next((w for w in words if w['text']=='Appliquer' and w['top']>top-12),None)
        tr=next((w for w in words if w['text']=='Transférer' and w['top']>top-12),None)
        re_=next((w for w in words if w['text']=='Ressources' and w['top']<top),None)
        stop=next((w['top'] for w in words if w['text'].startswith('Stratégies') and w['top']>top),p.height-40)
        if not (ap and tr): continue
        x_tr=tr['x0']-6; x_re=(re_['x0']-92) if re_ else W
        ct=next((w['top'] for w in words if re.match(r'^Conna[iî]tre',w['text']) and w['top']>top and w['x0']<x_tr),None)
        cut_top=ct if ct is not None else stop
        colA=[w for w in words if top<w['top']<cut_top-1 and w['x0']<x_tr]
        colT=[w for w in words if top<w['top']<cut_top-1 and x_tr<=w['x0']<x_re]
        colC=[w for w in words if ct is not None and ct-1<w['top']<stop and w['x0']<x_re]
        app=items([l for l in lines(colA) if not l[1].startswith('Appliquer')])
        con=items([l for l in lines(colC) if not re.match(r'^Conna[iî]tre',l[1])])
        tra=items([l for l in lines(colT) if not l[1].startswith('Transférer')])
        for typ,lst in (('savoir-faire',app),('compétence',tra),('savoir',con)):
            for a in lst:
                res.append({'matiere':MAT,'forme':FORME,'cadre':head.strip(),'uaa':uaa,'uaa_titre':titre,'competences':comp,'type':typ,'attendu':a,'page':pn})
json.dump(res,open(OUT,'w'),ensure_ascii=False,indent=1)
print(len(res),dict(Counter(r['type'] for r in res)),len({r['uaa'] for r in res}),'UAA')
