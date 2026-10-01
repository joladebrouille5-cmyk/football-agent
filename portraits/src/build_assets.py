# Prépare un paquet léger « tête + cou + épaules » à partir des fichiers CC0 de MakeHuman
import json, struct, os, re
MH='mh'; CUT_Y=4.7
V=[];groups={};cur=None;VT=[];FT={}
for line in open(f'{MH}/3dobjs/base.obj'):
    if line.startswith('v '): V.append(tuple(map(float,line.split()[1:4])))
    elif line.startswith('vt '): VT.append(tuple(map(float,line.split()[1:3])))
    elif line.startswith('g '): cur=line.split()[1]
    elif line.startswith('f '):
        toks=line.split()[1:]
        idx=[int(t.split('/')[0])-1 for t in toks]
        groups.setdefault(cur,[]).append(idx)
body=[f for f in groups['body'] if all(V[i][1]>CUT_Y for i in f)]
keep=set(i for f in body for i in f)
eyeL=sorted(set(i for f in groups['helper-l-eye'] for i in f)); eyeR=sorted(set(i for f in groups['helper-r-eye'] for i in f))
hairF=groups['helper-hair']; hairV=sorted(set(i for f in hairF for i in f))
# mhclo des yeux
clo=[];inv=False;meta={}
for line in open(f'{MH}/eyes/high-poly/high-poly.mhclo'):
    s=line.strip()
    if s.startswith('#') or not s: continue
    if s.startswith('verts'): inv=True; continue
    if inv:
        p=s.split()
        if len(p)==9: clo.append([int(p[0]),int(p[1]),int(p[2])]+list(map(float,p[3:])))
        continue
    p=s.split()
    if p[0] in ('x_scale','y_scale','z_scale'): meta[p[0]]=[int(p[1]),int(p[2]),float(p[3])]
cloV=set(i for c in clo for i in c[:3]) | set(v for k in meta.values() for v in k[:2])
keep |= set(eyeL)|set(eyeR)|set(hairV)|cloV
# repères (joints) utiles au cadrage
joints={}
for g in ('joint-head','joint-neck','joint-jaw','joint-l-clavicle','joint-r-clavicle','joint-head-2'):
    s=sorted(set(i for f in groups[g] for i in f)); joints[g]=s; keep|=set(s)
order=sorted(keep); remap={o:i for i,o in enumerate(order)}
tri=[]
for f in body:
    r=[remap[i] for i in f]
    tri += [r[0],r[1],r[2]] + ([r[0],r[2],r[3]] if len(r)==4 else [])
hairTri=[]
for f in hairF:
    r=[remap[i] for i in f]; hairTri += [r[0],r[1],r[2]] + ([r[0],r[2],r[3]] if len(r)==4 else [])
# œil high-poly
EV=[];EF=[]
for line in open(f'{MH}/eyes/high-poly/high-poly.obj'):
    if line.startswith('v '): EV.append(tuple(map(float,line.split()[1:4])))
    elif line.startswith('f '):
        idx=[int(t.split('/')[0])-1 for t in line.split()[1:]]
        EF += [idx[0],idx[1],idx[2]] + ([idx[0],idx[2],idx[3]] if len(idx)==4 else [])
# cibles
targets={}
for root,_,files in os.walk(f'{MH}/targets'):
    for fn in files:
        if not fn.endswith('.target'): continue
        name=os.path.relpath(os.path.join(root,fn),f'{MH}/targets')[:-7]
        ent=[]
        for line in open(os.path.join(root,fn)):
            if line.startswith('#') or not line.strip(): continue
            p=line.split(); i=int(p[0])
            if i in remap:
                d=tuple(float(x) for x in p[1:4])
                if any(abs(x)>1e-5 for x in d): ent.append((remap[i],)+d)
        targets[name]=ent
# binaire : positions f32, triangles u16/u32, cibles (indices u16 + deltas i16 quantifiés à 1e-4)
bin=bytearray(); idx={}
def put(key,fmt,arr):
    global bin
    while len(bin)%4: bin+=b'\0'
    idx[key]=[len(bin),len(arr),fmt]; bin+=struct.pack('<%d%s'%(len(arr),fmt),*arr)
put('pos','f',[c for i in order for c in V[i]])
put('tri','H' if len(order)<65536 else 'I',tri)
put('hairTri','H',hairTri)
put('eyeV','f',[c for v in EV for c in v]); put('eyeF','H',EF)
Q=1e4; tinfo={}
for name,ent in sorted(targets.items()):
    if not ent: continue
    put('t:'+name+':i','H',[e[0] for e in ent])
    put('t:'+name+':d','h',[max(-32767,min(32767,round(c*Q))) for e in ent for c in e[1:]])
open('assets/heads.bin','wb').write(bin)
info={'n':len(order),'remap':{k:[remap[i] for i in v] for k,v in {'eyeL':eyeL,'eyeR':eyeR,'hair':hairV}.items()},
 'joints':{k:[remap[i] for i in v] for k,v in joints.items()},
 'clo':[[remap[c[0]],remap[c[1]],remap[c[2]]]+c[3:] for c in clo],
 'cloScale':{k:[remap[v[0]],remap[v[1]],v[2]] for k,v in meta.items()},
 'idx':idx,'Q':Q}
json.dump(info,open('assets/heads.json','w'))
print('verts',len(order),'tris',len(tri)//3,'hair tris',len(hairTri)//3,'eye verts',len(EV),'targets',len([t for t in targets.values() if t]),'bin',len(bin))
