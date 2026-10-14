#!/usr/bin/env python3
"""Digital masters from the current mark and licensed Inter. Design tooling only.
Requires Python and fontTools; not part of the website production build.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.varLib.instancer import instantiateVariableFont
import base64, json, hashlib, re
R=Path(__file__).resolve().parent.parent
O=R/'design/brand/v8';E=O/'exports';E.mkdir(parents=True,exist_ok=True)
fp=R/'design/brand/v7/typefaces/Inter-CyrillicLatin.ttf'
fonts={w:instantiateVariableFont(TTFont(fp),{'wght':w,'opsz':14},inplace=False) for w in (500,750)}
def lettering(text,size,x,y,fill,weight=750,tracking=0):
 f=fonts[weight];g=f.getGlyphSet();cm=f.getBestCmap();scale=size/f['head'].unitsPerEm;out=[];cursor=x
 for char in text:
  glyph=g[cm[ord(char)]];pen=SVGPathPen(g);glyph.draw(pen)
  if pen.getCommands():out.append(f'<path fill="{fill}" d="{pen.getCommands()}" transform="translate({cursor:.4f} {y}) scale({scale:.8f} {-scale:.8f})"/>')
  cursor+=glyph.width*scale+tracking
 return ''.join(out),cursor-tracking-x
def mark(ink,accent,x=0,y=0,scale=1):
 return f'<g transform="translate({x} {y}) scale({scale})"><path fill="{ink}" d="M2.5 33V6.5h33V33h-3V9.5h-27V33Z"/><path fill="{accent}" d="M12 14.5h14v3H12Z"/><path fill="{ink}" d="M17.5 16h3v11h-3Z"/></g>'
tones={'ink':('#173c36','#a9844b'),'reverse':('#f6f5ef','#d7ed89'),'black':('#000000','#000000'),'white':('#ffffff','#ffffff')}
m={'version':'8.1','date':'2026-10-14','status':'digital masters; owner approval and trademark/print checks pending','sourceMark':'components/brand/brand-logo.tsx','font':'Inter / SIL OFL 1.1','fontSHA256':hashlib.sha256(fp.read_bytes()).hexdigest(),'colorSpace':'sRGB, not CMYK production art','files':[]}
for layout in ('horizontal','compact','symbol'):
 for tone,(ink,accent) in tones.items():
  if layout=='horizontal':
   letters,width=lettering('ПОТОЛКОВО',30,56,31,ink,tracking=-1.2)
   strap,sw=lettering('ПОТОЛКИ · СВЕТ · МОНТАЖ',8.2,56,47,ink,500,1.05)
   w=round(56+max(width,sw)+8,2);h=56;body=mark(ink,accent,4,6)+letters+strap
  elif layout=='compact':
   letters,width=lettering('ПОТОЛКОВО',26,12,96,ink,tracking=-1)
   w=round(width+24,2);h=114;body=mark(ink,accent,(w-60)/2,0,1.5)+letters
  else:w=h=48;body=mark(ink,accent,4,4)
  svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="ПОТОЛКОВО"><title>ПОТОЛКОВО · {layout} · {tone}</title>{body}</svg>'
  name=f'potolkovo-{layout}-{tone}.svg';(E/name).write_text(svg)
  m['files'].append({'file':'exports/'+name,'layout':layout,'tone':tone,'width':w,'height':h,'sha256':hashlib.sha256(svg.encode()).hexdigest()})
(O/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
def uri(p,mime):return 'data:'+mime+';base64,'+base64.b64encode(p.read_bytes()).decode()
content=(O/'brandbook-content.html').read_text()
def logo(match):
 layout,tone=match[1].split(':');return uri(E/f'potolkovo-{layout}-{tone}.svg','image/svg+xml')
content=re.sub(r'\{\{logo:([a-z]+:[a-z]+)\}\}',logo,content)
content=content.replace('{{font}}',uri(R/'public/brand/v7/inter-cyrillic-latin.woff2','font/woff2'))
content=content.replace('{{css}}',(O/'brandbook.css').read_text())
content=content.replace('{{photo}}',uri(R/'public/brand/v7/social/home.jpg','image/jpeg'))
assert '{{' not in content
(O/'POTOLKOVO-BRANDBOOK.html').write_text(content)
print('12 outlined SVG masters and offline brandbook generated.')
