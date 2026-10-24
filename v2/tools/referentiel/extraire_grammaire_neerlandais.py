import pdfplumber, re, json
from collections import Counter
LEV=re.compile(r'^(P[3-6]|S[1-3])$')
clean=lambda s: re.sub(r'\s+',' ',s).replace(' .','.').replace(' ,',',').strip()
res=[]
with pdfplumber.open('2022_REF_Lang-mod-LM.pdf') as pdf:
    for pn in range(28,107):
        p=pdf.pages[pn-1]; W,H=p.width,p.height
        txt=p.extract_text() or ''
        m=re.search(r'(Savoirs?|Savoir-faire)\s+grammaticaux\s*:\s*Néerlandais',txt)
        if not m: continue
        kind='savoir' if m.group(1).startswith('Savoirs') else 'savoir-faire'
        lm='LM II' if 'LANGUE MODERNE II' in txt[:60] else 'LM I'
        niv=next((w['text'] for w in p.extract_words() if LEV.match(w['text']) and w['top']>40 and w['x0']<W*0.2),None)
        # trouver la ligne d'en-tête pour borner la zone
        lines=p.extract_text_lines()
        top=next(l['top'] for l in lines if re.search(r'grammaticaux\s*:\s*Néerlandais',l['text']))
        stop=next((l['top'] for l in lines if l['top']>top+10 and re.match(r'^(Savoir-faire|Savoirs?\b(?! grammaticaux)|Niveau du CECRL|Compétence)',l['text'].strip())),H-40)
        for side,(x0,x1) in {'g':(0,W*0.5),'d':(W*0.5,W)}.items():
            pass
        left=p.crop((W*0.08,top+14,W*0.5,stop-1)).extract_text() or ''
        right=p.crop((W*0.5,top+14,W*0.97,stop-1)).extract_text() or ''
        rub=''; cur=None; items=[]
        for ln in left.split('\n'):
            ln=ln.strip()
            if not ln or LEV.match(ln) or ln in('<','>') or re.fullmatch(r'\d{1,3}',ln): continue
            if ln.startswith('•'):
                cur={'rub':rub,'t':ln.lstrip('• ').strip()}; items.append(cur)
            elif cur and not re.match(r'^[A-ZÉÈ][a-zé]+(?: [a-zéèà’]+){0,3}$',ln) and not ln[0].isupper():
                cur['t']+=' '+ln
            elif cur and cur['t'].count('(')>cur['t'].count(')'):
                cur['t']+=' '+ln
            else:
                rub=ln; cur=None
        att=clean(right)
        for it in items:
            res.append({'matiere':'Langues modernes','langue':'Néerlandais','lm':lm,'niveau':niv,'type':kind,'rubrique':it['rub'],'attendu':clean(it['t']),'attendu_type':att[:200],'page':pn})
json.dump(res,open('nl_gram.json','w'),ensure_ascii=False,indent=1)
print(len(res),dict(Counter(r['niveau'] for r in res)),dict(Counter(r['type'] for r in res)))
for r in res[:5]+res[-4:]: print(r['page'],r['lm'],r['niveau'],r['type'],'|',r['rubrique'],'=>',r['attendu'][:90])
