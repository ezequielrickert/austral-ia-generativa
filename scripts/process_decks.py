import re,glob,hashlib,base64,io,json,os,subprocess,tempfile,html as H
from PIL import Image
T='course/talksmith-ing/talks'; OUT='decks'
os.makedirs(OUT,exist_ok=True)
BLOCKS={}
def recompress(m):
    mime,b64=m.group(1),m.group(2)
    try: raw=base64.b64decode(b64)
    except Exception: return m.group(0)
    if len(raw)<40_000: return m.group(0)
    try:
        if mime.startswith('video/'):
            with tempfile.TemporaryDirectory() as d:
                i=os.path.join(d,'in.webm');o=os.path.join(d,'out.webm');open(i,'wb').write(raw)
                subprocess.run(['ffmpeg','-y','-loglevel','error','-i',i,'-vf','fps=15,scale=800:-2','-c:v','libvpx-vp9','-crf','48','-b:v','0','-an',o],check=True)
                nb=open(o,'rb').read()
                return f'data:video/webm;base64,{base64.b64encode(nb).decode()}' if len(nb)<len(raw) else m.group(0)
        im=Image.open(io.BytesIO(raw))
        buf=io.BytesIO()
        if getattr(im,'is_animated',False):
            frames=[];durs=[]
            step=max(1,im.n_frames//60)
            for k in range(0,im.n_frames,step):
                im.seek(k);fr=im.convert('RGBA');fr.thumbnail((640,640));frames.append(fr);durs.append(im.info.get('duration',80)*step)
            frames[0].save(buf,'WEBP',save_all=True,append_images=frames[1:],duration=durs,loop=0,quality=55,method=4)
        else:
            im.thumbnail((1600,1600))
            if im.mode not in('RGB','RGBA'):im=im.convert('RGBA')
            im.save(buf,'WEBP',quality=74,method=5)
        nb=buf.getvalue()
        if len(nb)>=len(raw): return m.group(0)
        return f'data:image/webp;base64,{base64.b64encode(nb).decode()}'
    except Exception as e:
        print('  skip',mime,len(raw),e); return m.group(0)
def gif2video(m):
    pre,b64,post=m.groups()
    try: raw=base64.b64decode(b64)
    except Exception: return m.group(0)
    try:
        im=Image.open(io.BytesIO(raw))
        if not getattr(im,'is_animated',False) or len(raw)<100_000: return m.group(0)
        with tempfile.TemporaryDirectory() as d:
            i=os.path.join(d,'in.gif');o=os.path.join(d,'out.webm');open(i,'wb').write(raw)
            subprocess.run(['ffmpeg','-y','-loglevel','error','-i',i,'-vf',"fps=12,scale='min(800,iw)':-2,format=yuv420p",'-c:v','libvpx-vp9','-crf','50','-b:v','0','-an',o],check=True)
            nb=open(o,'rb').read()
        attrs=pre+' '+post
        attrs=re.sub(r'\s(alt|loading|decoding)="[^"]*"','',attrs)
        alt=re.search(r'alt="([^"]*)"',pre+post)
        return f'<video{attrs} autoplay loop muted playsinline aria-label="{alt.group(1) if alt else ""}" src="data:video/webm;base64,{base64.b64encode(nb).decode()}"></video>'
    except Exception as e:
        print('  gif fail',e); return m.group(0)
def blockify(m):
    h=hashlib.md5(m.group(0).encode()).hexdigest()[:10]; BLOCKS[h]=m.group(0); return f'<!--B:{h}-->'
def top_sections(s):
    out=[];depth=0;start=None
    for m in re.finditer(r'<section\b[^>]*>|</section>',s):
        if m.group(0).startswith('<section'):
            if depth==0:start=m.start()
            depth+=1
        else:
            depth-=1
            if depth==0: out.append(s[start:m.end()])
    return out
def text(x): return H.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',x))).strip()
meta={}
for f in sorted(glob.glob(T+'/*/output/html/index.html')):
    slug=f.split('/')[-4]; s=open(f).read(); n0=len(s)
    s=re.sub(r'<img\b([^>]*?)src="data:image/gif;base64,([A-Za-z0-9+/=]+)"([^>]*)>',gif2video,s)
    s=re.sub(r'data:((?:image|video)/[a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)',recompress,s)
    secs=top_sections(s)
    slides=[]
    for i,sec in enumerate(secs):
        nested=len(re.findall(r'<section\b',sec))-1
        t=re.search(r'<h[12][^>]*>([\s\S]*?)</h[12]>',sec)
        slides.append({'i':i,'title':text(t.group(1)) if t else '','text':text(re.sub(r'<(script|style|svg)[\s\S]*?</\1>','',sec))[:700],'nested':nested})
    os.makedirs(f'decks_std/{slug}',exist_ok=True)
    open(f'decks_std/{slug}/index.html','w').write(s)
    s=re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>',blockify,s)
    open(f'{OUT}/{slug}.html','w').write(s)
    json.dump(slides,open(f'{OUT}/{slug}.slides.json','w'),ensure_ascii=False,indent=0)
    meta[slug]=len(slides)
    print(slug.ljust(34),n0//1024,'->',len(s)//1024,'KB',len(slides),'slides',sum(x['nested'] for x in slides),'nested')
json.dump(BLOCKS,open(f'{OUT}/_blocks.json','w'))
print('blocks KB',sum(map(len,BLOCKS.values()))//1024)
tot=sum(os.path.getsize(f) for f in glob.glob(OUT+'/*.html'))+sum(map(len,BLOCKS.values()))
print('TOTAL MB',round(tot/1048576,2))
