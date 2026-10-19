"""Build an original MMX mission-profile SVG and a self-contained reading page."""
from pathlib import Path
import base64
import hashlib
import html
import json
import math
import random
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/infographics'
OUT.mkdir(parents=True, exist_ok=True)
D = json.loads((ROOT / 'docs/data/transfer.json').read_text())
AU = D['meta']['au_km']
W, H = 1600, 990
C = dict(bg='#101418', ground='#151c23', line='#34424f', faint='#26333f', ink='#ecf0f4', dim='#b0bdc9', mute='#8193a5', blue='#3987e5', gold='#b09025', pale='#a9cef1')
parts = []

def emit(s): parts.append(s)
def esc(s): return html.escape(str(s), quote=True)
def attrs(**kw): return ' '.join(f'{k.replace("_", "-")}="{esc(v)}"' for k,v in kw.items() if v is not None)
def path(d, fill='none', stroke=None, sw=1, **kw):
    emit(f'<path d="{d}" {attrs(fill=fill, stroke=stroke, stroke_width=sw, **kw)}/>')
def line(x1,y1,x2,y2,col=None,sw=1,**kw):
    emit(f'<line {attrs(x1=x1,y1=y1,x2=x2,y2=y2,stroke=col or C["line"],stroke_width=sw,**kw)}/>')
def rect(x,y,w,h,fill,stroke=None,rx=0,**kw):
    emit(f'<rect {attrs(x=x,y=y,width=w,height=h,fill=fill,stroke=stroke,rx=rx,**kw)}/>')
def circle(x,y,r,fill,stroke=None,sw=1,**kw):
    emit(f'<circle {attrs(cx=x,cy=y,r=r,fill=fill,stroke=stroke,stroke_width=sw,**kw)}/>')
def ellipse(x,y,rx,ry,fill='none',stroke=None,sw=1,**kw):
    emit(f'<ellipse {attrs(cx=x,cy=y,rx=rx,ry=ry,fill=fill,stroke=stroke,stroke_width=sw,**kw)}/>')
def poly(points,fill,stroke=None,sw=1,**kw):
    emit(f'<polygon points="{" ".join(f"{x:.2f},{y:.2f}" for x,y in points)}" {attrs(fill=fill,stroke=stroke,stroke_width=sw,**kw)}/>')
def text(x,y,s,size=12,col=None,weight=400,mono=False,anchor='start',**kw):
    emit(f'<text {attrs(x=x,y=y,fill=col or C["ink"],font_size=size,font_weight=weight,font_family="Menlo, monospace" if mono else "Helvetica Neue, Helvetica, Arial, sans-serif",text_anchor=anchor,**kw)}>{esc(s)}</text>')
def multiline(x,y,lines,size=12,gap=18,**kw):
    for i,s in enumerate(lines): text(x,y+i*gap,s,size,**kw)
def group(transform='',**kw): emit(f'<g {attrs(transform=transform or None,**kw)}>')
def end(): emit('</g>')
def tooltip(title,detail): emit(f'<title>{esc(title)}</title><desc>{esc(detail)}</desc>')
def section(x,y,n,title,subtitle=''):
    text(x,y,n,11,C['mute'],mono=True,letter_spacing=2)
    text(x+33,y,title,19,weight=550)
    if subtitle: text(x+33,y+22,subtitle,10.5,C['dim'],mono=True)

def orbit_path(a):
    return 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in a)

def project(states):
    a = np.array(states, dtype=float)[...,:3] / AU
    e = math.radians(23.4392911)
    xe = a[...,0]; ye = a[...,1]*math.cos(e)+a[...,2]*math.sin(e)
    q = math.radians(-45)
    x = xe*math.cos(q)-ye*math.sin(q); y=xe*math.sin(q)+ye*math.cos(q)
    return np.stack([490+220*x, 440-220*.53*y], axis=-1)

def arrow(a,b,color,scale=1):
    a=np.asarray(a); b=np.asarray(b); v=(b-a)/np.linalg.norm(b-a); n=np.array([-v[1],v[0]])
    poly([b,b-8*scale*v+3.5*scale*n,b-8*scale*v-3.5*scale*n],color)

def planet(x,y,r,kind='earth'):
    group()
    if kind=='earth':
        circle(x,y,r,'url(#earth)','none')
        # Stylized continents are illustration, not a mapped hemisphere.
        path(f'M{x-r*.45},{y-r*.73} l{r*.48},{r*.12} {r*.16},{r*.35} {-r*.27},{r*.26} {r*.1},{r*.35} {-r*.23},{r*.36} {-r*.22},{-r*.52} {-r*.28},{-r*.25} Z','#7895a0',opacity='.7')
        path(f'M{x+r*.34},{y-r*.68} l{r*.38},{r*.32} {-r*.12},{r*.42} {-r*.32},{r*.03} {-r*.11},{-r*.3} Z','#7895a0',opacity='.6')
        circle(x,y,r,'url(#night)',C['pale'],.7)
    else:
        circle(x,y,r,'url(#mars)',stroke='#b79076',sw=.5)
        rng=random.Random(31)
        for _ in range(22):
            dx,dy=rng.uniform(-.8,.8)*r,rng.uniform(-.8,.8)*r
            if dx*dx+dy*dy < (r*.81)**2:
                ellipse(x+dx,y+dy,rng.uniform(.03,.1)*r,rng.uniform(.015,.04)*r,'#704331',opacity='.24')
        path(f'M{x-r*.6},{y+r*.1} q{r*.6},{-r*.36} {r*1.1},{r*.12} q{-r*.45},{-r*.04} {-r*.9},{r*.2}',fill='#613e35',opacity='.35')
        circle(x,y,r,'url(#night)')
    end()

def phobos(x,y,s=1):
    group(f'translate({x} {y}) scale({s}) rotate(-15)')
    body='M-68,-17 C-72,-43 -35,-57 -6,-52 C23,-61 45,-38 60,-22 C82,-4 64,28 39,40 C13,64 -29,48 -44,35 C-63,30 -76,7 -68,-17Z'
    path(body,fill='url(#phobos)',stroke='#a89b89',sw=1)
    rng=random.Random(84)
    for _ in range(37):
        px,py=rng.uniform(-54,52),rng.uniform(-39,35)
        if (px/60)**2+(py/42)**2<.88:
            r=rng.uniform(1.3,6)
            ellipse(px,py,r,r*.67,'#4a4742','#a59b8d',.45)
            path(f'M{px-r},{py} Q{px},{py-r*1.3} {px+r},{py}',stroke='#c4b7a3',sw=.65,opacity='.35')
    ellipse(-30,-10,21,18,'#4b4844','#b7aa96',1)
    ellipse(-30,-10,14,12,'#605b51',stroke='#393b3a',sw=1)
    for i in range(7):
        path(f'M{2+i*5},{-34+i*1.5} q-13,21 -8,49',stroke='#c1b19c',sw=.6,opacity='.25')
    end()


def spacecraft(x,y,s=1):
    group(f'translate({x} {y}) scale({s})')
    # A purposeful illustrated assembly, not engineering CAD.
    for side in [-1,1]:
        line(side*35,-10,side*164,-24,'#8e9eab',6)
        line(side*35,-10,side*164,-24,'#d1d9de',1)
        points=[(side*91,-54),(side*215,-65),(side*216,-1),(side*92,10)]
        poly(points,'#172c42','#93a6b8',1.3)
        for i in range(1,7):
            t=i/7
            line(side*(91+124*t),-54-11*t,side*(92+124*t),10-11*t,'#5c7b98',.7)
        for i in range(1,5):
            t=i/5
            line(side*(91+t),-54+64*t,side*(215+t),-65+64*t,'#5c7b98',.7)
        for i in range(7):
            for j in range(5):
                circle(side*(100+i*17.4),-48+j*12.8-i*1.5,.5,'#a5c2d8')
    for side in [-1,1]:
        for yy in [-7,17]:
            line(side*32,yy,side*70,66+yy*.35,'#8d9da8',3)
            line(side*30,yy+4,side*62,66+yy*.35,'#566573',2)
            ellipse(side*67,67+yy*.35,10,3,'#758792','#bcc9cf',.8)
    # Return bus above the exploration/landing frame; propulsion module is absent at Phobos.
    poly([(-44,-30),(26,-39),(50,-21),(-20,-12)],'#dfc576','#fae7b0',.8)
    poly([(-44,-30),(-20,-12),(-20,34),(-44,17)],'#8e702e','#d5b868',.8)
    poly([(-20,-12),(50,-21),(50,25),(-20,34)],'#b39a51','#e0c883',.8)
    for xx in [-8,9,27]:
        path(f'M{xx},-10 l8,13 -5,16 13,7',stroke='#e8d38e',sw=.6,opacity='.55')
    poly([(-42,20),(30,13),(52,30),(-20,41)],'#b7c4c9','#e2e8e8',.8)
    poly([(-42,20),(-20,41),(-20,56),(-42,37)],'#596c77','#b8c7d0',.8)
    poly([(-20,41),(52,30),(52,45),(-20,56)],'#85969d','#c1cfd5',.8)
    for xx in [-12,5,22,39]: circle(xx,46,1.2,'#d2dce0')
    ellipse(-43,-10,14,18,'#35464f','#d0d9da',1)
    ellipse(-45,-10,11,14,'#bbb8a7','#e0ddcc',.8)
    path('M-54 -11q9 -12 18 0q-8 12-18 0Z','#dbd7c4','#7d8b8d',.6)
    # Communication dish, feed and the instrument deck.
    line(22,-43,47,-64,'#a3aeb5',4)
    ellipse(49,-69,26,21,'#c9d0d1','#ecf1f0',.8,transform='rotate(-22 49 -69)')
    ellipse(49,-69,19,15,'#9aa7ab',transform='rotate(-22 49 -69)')
    line(46,-71,56,-93,'#e2e8e5',1.4)
    line(32,-73,56,-93,'#b4c4cb',.9)
    line(62,-58,56,-93,'#b4c4cb',.9)
    circle(56,-93,2.2,'#eef1e6')
    rect(-37,-17,13,13,'#435867','#9baebc',1)
    circle(-30,-10,3,'#0e1f2e','#dce9ee',.6)
    line(-38,-36,-57,-82,'#b4c0c6',1.3)
    circle(-57,-82,1.8,'#dde4e8')
    # Sampler arm and contact head.
    line(25,26,37,46,'#d0b96e',4)
    line(37,46,22,61,'#c4ced0',3)
    circle(37,46,4,'#788993','#d0d9db',.8)
    ellipse(22,63,7,3,'#adbdc4','#dbe2e5',.8)
    for xx,yy in [(-42,-27),(47,-18),(-20,31),(47,23)]: circle(xx,yy,1.2,'#f1ddaa')
    end()

emit(f'<svg xmlns="http://www.w3.org/2000/svg" width="2880" height="1782" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title description">')
emit('<title id="title">MMX mission profile: Earth to Phobos and back</title><desc id="description">An original independent mission infographic with the retrieved 2026–2027 outbound planning trajectory, schematic Mars capture and Phobos operations, two sample-collection techniques, and planned Earth return in 2031. All hardware sizes and later mission paths are illustrative.</desc>')
emit('''<defs>
<radialGradient id="sun" cx="35%" cy="30%"><stop stop-color="#fff0be"/><stop offset=".75" stop-color="#dbb96c"/><stop offset="1" stop-color="#a47a30"/></radialGradient>
<radialGradient id="earth" cx="32%" cy="28%"><stop stop-color="#84b9cd"/><stop offset=".5" stop-color="#2b6d99"/><stop offset="1" stop-color="#102639"/></radialGradient>
<radialGradient id="mars" cx="30%" cy="25%"><stop stop-color="#dfba8d"/><stop offset=".47" stop-color="#b57e55"/><stop offset=".8" stop-color="#724e3a"/><stop offset="1" stop-color="#2a2828"/></radialGradient>
<linearGradient id="night"><stop offset=".15" stop-color="#080d12" stop-opacity="0"/><stop offset=".65" stop-color="#080d12" stop-opacity=".1"/><stop offset="1" stop-color="#080d12" stop-opacity=".9"/></linearGradient>
<radialGradient id="phobos" cx="30%" cy="20%"><stop stop-color="#b8aa95"/><stop offset=".5" stop-color="#817b70"/><stop offset="1" stop-color="#393c3c"/></radialGradient>
<linearGradient id="metal"><stop stop-color="#5a6c79"/><stop offset=".35" stop-color="#d0dce1"/><stop offset=".6" stop-color="#8b9eaa"/><stop offset="1" stop-color="#4e616f"/></linearGradient>
<pattern id="regolith" width="23" height="18" patternUnits="userSpaceOnUse"><rect width="23" height="18" fill="#353b3e"/><circle cx="3" cy="4" r="1" fill="#747771"/><circle cx="16" cy="13" r="1.4" fill="#666d69"/><path d="M9 10l3-2 2 3-3 1Z" fill="#85867a"/></pattern>
</defs>''')
rect(0,0,W,H,C['bg'])
# Quiet border and original masthead.
line(48,121,1552,121,C['line'])
text(48,51,'MARTIAN MOONS EXPLORATION',11,C['dim'],mono=True,letter_spacing=2.1)
text(46,101,'MMX',56,weight=650,letter_spacing=-2)
text(210,77,'Earth to Phobos. Samples home to Earth.',31,weight=450)
text(212,103,'Investigating the origin of Mars’s moons, from orbital surveys to samples in Earth laboratories.',12,C['dim'])
text(1552,48,'MISSION PROFILE',11,C['dim'],mono=True,anchor='end',letter_spacing=1.5)
text(1552,74,'2026—2031',22,weight=500,anchor='end')
text(1552,101,'PRE-LAUNCH PLAN',10,C['mute'],mono=True,anchor='end')
# Chronological waypoints.
phases=[('2026','19 Oct UTC · H3 F10 launch'),('2027','Arrive at Mars'),('2027–2030','Explore & sample Phobos'),('2030','Leave Mars'),('2031','Return samples to Earth')]
for i,(year,label) in enumerate(phases):
    x=65+i*305
    if i<4: line(x+12,157,x+289,157,C['line'],1)
    circle(x,157,4.2,C['blue'] if i<2 else C['gold'])
    text(x+16,153,year,15,weight=550,mono=True)
    text(x+16,175,label,11.5,C['dim'])
# Main orbital panel.
section(48,224,'01','The interplanetary journey','Outbound: retrieved planning states • later flight: schematic')
for name in ['mars','earth']:
    a=project(D['orbits'][name]['position_km'])
    path(orbit_path(a),stroke=C['line'],sw=1.2)
text(751,330,'Mars orbit',10.5,C['mute'],mono=True)
text(579,390,'Earth orbit',10.5,C['mute'],mono=True)
a=project(D['states']['mmx'])
group(tabindex='0',data_tip='Outbound cruise | 313 days, 7 h, 57 min of retrieved planning states, ending before the arrival-model splice.')
tooltip('Earth-to-Mars transfer','JPL Horizons target −239, geometric states. 19 October 2026 21:00 UTC through 29 August 2027 04:57 UTC. No interpolation crosses the arrival-model discontinuity.')
path(orbit_path(a),stroke=C['blue'],sw=3,stroke_linecap='round')
end()
for days in [50,175,280]:
    idx=int(np.argmin(np.abs(np.array(D['elapsed_s'])-days*86400)))
    arrow(a[idx-1],a[idx],C['blue'],1.1)
# Selected monthly markers, all sampled from the same data projection.
for days,label,dx,dy in [(74,'JAN 2027',16,-12),(164,'APR',-21,-18),(255,'JUL',-39,-3)]:
    idx=int(np.argmin(np.abs(np.array(D['elapsed_s'])-days*86400)))
    p=a[idx]; circle(*p,3,C['blue'],C['bg'],1.2); text(p[0]+dx,p[1]+dy,label,9,C['dim'],mono=True)
# Sun and source-defined endpoints.
circle(490,440,18,'url(#sun)'); circle(490,440,24,'none',C['gold'],.6,opacity='.5')
text(490,480,'SUN',10.5,C['dim'],mono=True,anchor='middle')
text(490,518,'313 days',24,weight=550,anchor='middle')
text(490,537,'retrieved outbound arc',9.5,C['dim'],mono=True,anchor='middle')
earth=a[0]; mars=a[-1]
planet(*earth,11,'earth'); planet(*mars,14,'mars')
text(earth[0]+23,earth[1]-8,'Earth departure',14,weight=550)
text(earth[0]+23,earth[1]+11,'19 Oct 2026',11,C['dim'],mono=True)
text(earth[0]+23,earth[1]+27,'first state: 21:00 UTC',8.5,C['mute'],mono=True)
text(mars[0]-27,mars[1]+33,'Mars arrival',14,weight=550)
text(mars[0]-27,mars[1]+52,'Aug 2027',11,C['dim'],mono=True)
# Mars moves substantially while MMX cruises.
m0=project([D['states']['mars'][0]])[0]
circle(*m0,6,'none',C['mute'],1.2)
line(m0[0]+7,m0[1]-3,m0[0]+29,m0[1]-20,C['mute'],.7)
text(m0[0]+36,m0[1]-20,'Mars at departure',10,C['dim'])
# A separate illustrative return arc, unmistakably not another propagated trajectory.
path('M200 516 C242 591 510 605 635 527',stroke=C['gold'],sw=2.2,stroke_dasharray='7 6',stroke_linecap='round')
arrow([608,542],[635,527],C['gold'],1.1)
planet(650,518,9,'earth')
group('translate(620 537) rotate(-27)')
path('M-7 3Q0-8 7 3Z','#bac7cc','#e7eeef',.7)
path('M-8 3Q0 7 8 3',stroke='#526a78',sw=2)
end()
text(390,561,'MARS → EARTH',10,C['dim'],mono=True,anchor='middle',letter_spacing=1)
text(390,606,'2030–2031 • return concept only',10,C['mute'],mono=True,anchor='middle')
text(670,532,'Sample capsule',11,C['ink']); text(670,549,'Earth return · 2031',10,C['dim'],mono=True)
# Orbit key and an explicit plan-data boundary.
line(64,622,95,622,C['blue'],2.5); text(104,626,'Outbound ephemeris',10,C['dim'])
line(279,622,310,622,C['gold'],2,stroke_dasharray='5 4'); text(319,626,'Schematic mission path',10,C['dim'])
line(548,622,579,622,C['line'],1.4); text(588,626,'Planet reference orbit',10,C['dim'])
text(64,646,'Projected J2000 ecliptic plane • planet/body sizes enlarged',9.5,C['mute'],mono=True)
# Mars operations panel.
line(925,207,925,659,C['line'],.8)
section(960,224,'02','Capture, then fly with Phobos','Mars-centered concept • not a reconstructed insertion sequence')
# Capture ellipses are deliberately drawn as a separate explanatory schematic.
group(tabindex='0',data_tip='Mars capture | Retrograde burns capture the spacecraft, reshape and tilt its orbit, then match the Phobos orbital region. Paths are schematic.')
tooltip('Mars orbit insertion','Conceptual sequence only. The displayed outbound ephemeris stops before a planning-arc splice and does not resolve these burns.')
path('M1530 275 C1420 248 1194 256 1080 355 C1010 419 1092 483 1220 464 C1400 440 1493 326 1453 286',stroke=C['gold'],sw=1.7,stroke_dasharray='7 5')
path('M1453 286 C1395 299 1260 322 1145 389 C1100 415 1150 460 1220 441 C1340 413 1415 337 1400 315',stroke=C['gold'],sw=1.6,stroke_dasharray='7 5')
end()
# Phobos orbit, physically a moon orbit rather than an MMX orbit centered on Phobos.
ellipse(1208,399,142,44,stroke='#6f7f8b',sw=1.15,transform='rotate(-10 1208 399)')
planet(1208,399,44,'mars')
text(1208,459,'MARS',10,C['dim'],mono=True,anchor='middle')
for x,y,n in [(1080,355,'1'),(1453,286,'2'),(1348,382,'3')]:
    circle(x,y,8,C['bg'],C['gold'],1.3); text(x,y+3,n,8.5,C['ink'],mono=True,anchor='middle')
text(1014,292,'1  Capture into Mars orbit',11.5,C['ink'])
text(1014,310,'2  Reshape & align the orbit',11.5,C['ink'])
text(1014,328,'3  Reach the Phobos orbital region',11.5,C['ink'])
text(1375,444,'Phobos orbit',10.5,C['dim'])
text(1375,461,'~9,400 km semimajor axis',9,C['mute'],mono=True)
text(1375,477,'from Mars’s center',9,C['mute'],mono=True)
# Local Phobos scene and relative-motion path.
phobos(1113,558,.7)
path('M1023 541 C1036 504 1150 489 1218 523 C1265 550 1210 594 1145 597',stroke=C['blue'],sw=1.8)
arrow([1198,593],[1179,597],C['blue'],.85)
spacecraft(1228,518,.24)
text(1284,505,'PHOBOS',17,weight=550)
text(1284,526,'~27 × 22 × 18 km',10.5,C['dim'],mono=True)
multiline(1284,549,['MMX flies nearby in quasi-satellite','orbits while both travel around Mars.'],11,17,col=C['dim'])
text(1008,607,'Relative-motion sketch near Phobos',9,C['mute'],mono=True)
text(1008,627,'Observe → descend → land → collect → ascend',11,C['ink'])
text(1008,644,'The Martian moon is the sample target—not Mars itself.',10,C['mute'])
# Lower panel: probe and two sampler cross-sections.
line(48,675,1552,675,C['line'])
section(48,710,'03','The probe','Illustrated flight hardware • not to scale')
spacecraft(260,823,.65)
text(64,923,'At Phobos: exploration + return modules together.',10.5,C['dim'])
text(64,942,'Propulsion module discarded after Mars capture.',10.5,C['dim'])
line(506,699,506,945,C['line'],.7)
section(537,710,'04','Two ways to collect Phobos','Complementary sampling of the surface and subsurface')
text(1545,710,'≥10 g',23,weight=550,anchor='end')
text(1545,731,'Total return target • two sites planned',9.5,C['dim'],anchor='end')
# Coring sampler panel.
text(550,758,'C-SMP  /  CORING',12,weight=600,mono=True)
text(550,779,'Drive a hollow corer into regolith',12,C['dim'])
# All geometry is original, schematic cross-sectional hardware.
group('translate(586 797)',tabindex='0',data_tip='Coring sampler | A coring tube penetrates below the surface to collect material less altered by space weathering.')
tooltip('Coring sampler, C-SMP','Arm-operated mechanical subsurface sampling; a hollow tube is driven approximately 2 cm into the surface, then retrieved and stored.')
rect(-16,65,191,66,'url(#regolith)')
path('M-16 64l15 3 15-3 13 2 17-2 19 2 19-3 16 2 18-1 17 3 15-3 17 2',stroke='#abb2aa',sw=1.2)
rect(51,4,44,24,'#6d7e88','#c1cbd0',3)
rect(59,28,28,74,'url(#metal)','#d4dce1',.7)
rect(66,36,14,69,C['ground'],'#a6b3ba',.65)
rect(67,76,12,28,'#9f957e','#c7baa0',.6)
poly([(59,102),(65,105),(65,96),(59,94)],'#d4dce1','#d4dce1',.5)
poly([(81,96),(81,105),(87,102),(87,94)],'#d4dce1','#d4dce1',.5)
rect(43,-3,60,8,'#4c606e','#b9c6ce',1)
for yy in [35,42,49,56]: line(59,yy,65,yy-2,'#30434e',.8)
line(73,-11,73,-3,'#c5d2d9',3)
line(122,67,122,103,C['dim'],.8)
line(118,67,126,67,C['dim'],.8); line(118,103,126,103,C['dim'],.8)
text(134,90,'~2 cm',10,C['ink'],mono=True)
end()
multiline(797,820,['A tube penetrates','below the surface,','retaining a core of','regolith for return.'],11,17,col=C['dim'])
text(550,942,'JAXA  /  subsurface regolith',10.5,C['ink'],weight=550)
# Pneumatic sampler panel.
line(1013,748,1013,945,C['line'],.7)
text(1044,758,'P-SMP  /  PNEUMATIC',12,weight=600,mono=True)
text(1044,779,'Nitrogen jets at a landing foot',12,C['dim'])
group('translate(1070 797)',tabindex='0',data_tip='Pneumatic sampler | Pressurized gas mobilizes surface grains and carries them through the sampler into a collection chamber.')
tooltip('Pneumatic sampler, P-SMP','A gas pulse lifts surface regolith and carries it into a collection container, complementing the mechanical core.')
rect(-8,90,184,41,'url(#regolith)')
path('M-8 89l17 3 18-3 16 2 20-2 17 3 19-2 16 1 20-2 20 3 21-2',stroke='#abb2aa',sw=1.2)
path('M-1 -12L18 -10 59 82',stroke='#778b98',sw=8)
path('M-1 -12L18 -10 59 82',stroke='#b5c3cd',sw=1.2)
rect(23,0,27,37,'url(#metal)','#cfdae0',4)
rect(22,10,29,5,'#6a7c87','#a9b9c3',1)
path('M37 38 V58 H75 V74',stroke='#748fa4',sw=5,stroke_linejoin='round')
path('M37 38 V58 H75 V74',stroke=C['blue'],sw=1.6)
path('M63 66H115L133 88H51Z','#a0acb0','#d2dce0',.9)
path('M70 75H108L117 87H60Z',C['ground'])
path('M102 74V39H145V17',stroke='#899ca7',sw=9,stroke_linejoin='round')
path('M102 74V39H145V17',stroke=C['ground'],sw=5)
rect(130,-8,32,28,'url(#metal)','#cfdae0',3)
rect(137,0,18,14,'#b9a77e','#e1cfa2',1)
for px,py in [(83,83),(91,76),(100,66),(104,53),(113,40),(127,38),(144,28),(143,11)]:
    circle(px,py,1.9,'#d6c6a1')
for dx in [-12,0,12]:
    path(f'M75 77q{dx} 8 {dx+7} 12',stroke=C['blue'],sw=1)
end()
multiline(1275,819,['Nitrogen lifts surface grains.','Further gas flow carries','them up the tube and','into a sample canister.'],11,17,col=C['dim'])
text(1044,942,'NASA · Honeybee Robotics  /  surface grains',10.5,C['ink'],weight=550)
# A factual caption rather than an official-looking byline.
line(48,958,1552,958,C['line'])
text(48,978,'Data: JAXA / ISAS • JPL Horizons −239 • DE440s | Geometry beyond the outbound arc is schematic.',8.6,C['mute'],mono=True)
text(1552,978,'Independent mission study  |  Illustration: Mickey',9,C['dim'],mono=True,anchor='end')
emit('</svg>')
svg='\n'.join(parts)+'\n'
(OUT/'mmx-mission-profile.svg').write_text(svg)
manifest={
 'title':'MMX Mission Profile','dimensions_px':[2880,1782], 'size_inches':[16,9.9],'dpi':180,
 'status':'Independent pre-launch planning infographic; not an official JAXA publication.',
 'outbound_source':'../data/transfer.json','outbound_source_sha256':hashlib.sha256((ROOT/'docs/data/transfer.json').read_bytes()).hexdigest(),
 'start_utc':D['meta']['start_utc'],'end_utc':D['meta']['end_utc'],
 'duration_days':D['meta']['duration_s']/86400,
 'coordinate_transform':{'source':'Geometric Sun-centered ICRF equatorial','display':'J2000 mean ecliptic XY, rotated -45 degrees in plane and vertically foreshortened by 0.53','obliquity_degrees':23.4392911,'scale_px_per_au':220},
 'illustrative_elements':['Mars insertion sequence','quasi-satellite orbit','return concept','enlarged bodies','probe assembly','sampler cross-sections'],
 'boundary_note':'The outbound path ends at 2027-08-29 04:57 UTC before the source planning-arc discontinuity; no resolved insertion burn or return ephemeris is claimed.'}
(OUT/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Wrote {OUT}/mmx-mission-profile.svg ({len(svg):,} characters)')

sources = json.loads((OUT / 'sources.json').read_text())
source_items = ''.join(f'<li><a href="{esc(r["url"])}" target="_blank" rel="noopener">{esc(r["title"])}</a><p>{esc(r["supports"])}</p></li>' for r in sources['sources'])
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>MMX Mission Profile</title>
<style>
/* A flight-profile plate, with readable region crops and its scientific record below. */
:root{color-scheme:dark;--bg:#101418;--panel:#19232c;--ink:#ecf0f4;--dim:#b0bdc9;--line:#34424f;--accent:#a9cef1;--display:"Helvetica Neue",Helvetica,Arial,sans-serif;--utility:Menlo,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.65 var(--display);padding-block:22px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}main{max-width:1600px;margin:auto;min-width:0}a{color:var(--accent)}.top,.actions,.tabs{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.top{justify-content:space-between;margin-bottom:18px}.top strong{font-size:16px}.actions a,button{border:1px solid var(--line);border-radius:4px;padding:7px 11px;background:var(--panel);color:var(--ink);font:11px var(--utility);text-decoration:none;cursor:pointer}a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button[aria-pressed="true"]{border-color:var(--accent)}.tabs{margin-bottom:12px}.hint{font:11px var(--utility);color:var(--dim);margin:10px 0 20px}.plate{position:relative;border:1px solid var(--line)}.plate svg{display:block;width:100%;height:auto}.plate [data-tip]{cursor:help}.tooltip{position:fixed;max-width:min(360px,calc(100vw - 32px));padding:10px 13px;background:var(--panel);border:1px solid var(--line);border-radius:4px;font:12px/1.6 var(--utility);z-index:5;pointer-events:none}.record{max-width:1150px;margin:36px auto 0}.record h1{font-size:25px;line-height:1.3;font-weight:550;letter-spacing:-.02em}.record h2{font-size:18px;margin-top:28px}.record p{max-width:80ch;color:var(--dim)}.notice{border-left:2px solid var(--line);padding-left:16px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;vertical-align:top;border-bottom:1px solid var(--line);padding:12px 14px}th{color:var(--dim);font-weight:500}li{margin-bottom:15px}li p{margin:4px 0;font-size:12px}.sources{columns:2;column-gap:40px;padding-left:22px}.sources li{break-inside:avoid}footer{font:11px var(--utility);color:var(--dim);margin-top:28px}[hidden]{display:none!important}@media(max-width:650px){.top{align-items:flex-start}.actions{gap:5px}.actions a,.tabs button{padding:8px;font-size:10px}.sources{columns:1}.record h1{font-size:22px}th,td{padding:10px 8px}.hint{line-height:1.6}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body><main>
<header class="top"><strong>MMX mission profile</strong><nav class="actions" aria-label="Downloads and orbit viewers"><a href="mmx-mission-profile.png" download>PNG · 2880 × 1782</a><a href="mmx-mission-profile.svg" download>SVG · vector</a><a href="mmx-mission-profile.pdf" download>PDF · 16 × 9.9 in</a><a href="../index.html">Earth departure ↗</a><a href="../transfer.html">Mars transfer ↗</a></nav></header>
<nav class="tabs" aria-label="Figure regions"><button id="view-full" data-box="0 0 1600 990" aria-pressed="true">Full figure</button><button id="view-journey" data-box="42 196 882 464" aria-pressed="false">Interplanetary journey</button><button id="view-phobos" data-box="952 196 612 464" aria-pressed="false">Mars &amp; Phobos</button><button id="view-probe" data-box="42 688 465 260" aria-pressed="false">Probe</button><button id="view-samples" data-box="530 688 1022 260" aria-pressed="false">Sampling methods</button><button id="view-corer" data-box="530 740 470 210" aria-pressed="false">Coring detail</button><button id="view-pneumatic" data-box="1032 740 520 210" aria-pressed="false">Pneumatic detail</button></nav>
<div class="plate">__SVG__</div><p class="hint">Choose a region to enlarge it. Hover or focus the transfer path and sampling mechanisms for context.</p><div class="tooltip" id="tip" role="status" hidden></div>
<section class="record"><h1>From a retrieved transfer arc to a complete mission story</h1>
<p class="notice"><strong>Independent pre-launch planning illustration.</strong> The blue outbound path is our retrieved JAXA planning trajectory, not a generic Hohmann transfer. The dashed gold return and Mars-capture paths are concepts, not propagated future spacecraft states. Body sizes, probe details and sampler cross-sections are illustrative.</p>
<div class="table-wrap"><table><thead><tr><th>Phase</th><th>Planned timing</th><th>What is supported</th></tr></thead><tbody>
<tr><td>Launch</td><td>19 October 2026<br>19:41:03 UTC</td><td>JAXA H3 F10 launch schedule. The same event is 20 October, 04:41:03 in Japan (JST).</td></tr>
<tr><td>Retrieved outbound arc</td><td>19 October 2026, 21:00 UTC<br>to 29 August 2027, 04:57 UTC</td><td>8,503 geometric Horizons −239 states. Duration: 313 days, 7 hours, 57 minutes. Sun-centered ICRF states are projected into mean J2000 ecliptic XY for the figure.</td></tr>
<tr><td>Mars arrival</td><td>August 2027</td><td>Official planned arrival month. Our numerical arc ends before a 04:57–04:58 UTC planning-solution discontinuity on 29 August. That cutoff is not an official insertion timestamp or a resolved burn.</td></tr>
<tr><td>Phobos operations</td><td>2027–2030</td><td>Reconnaissance, site selection, rover deployment, landings and sampling. Quasi-satellite paths describe relative motion near Phobos while MMX and Phobos both orbit Mars.</td></tr>
<tr><td>Mars departure / return</td><td>2030 / 2031</td><td>Planned mission-year milestones. No spacecraft return ephemeris is included in this study. Only the capsule re-enters Earth’s atmosphere; the illustrated Earth-return marker is schematic.</td></tr>
<tr><td>C-SMP</td><td>Shallow subsurface</td><td>A robotic arm operates a hollow cylindrical corer driven into regolith, approximately 2 cm deep. Material is retained and transferred to sample storage. It is not a rotating drill.</td></tr>
<tr><td>P-SMP</td><td>Surface grains</td><td>High-pressure nitrogen jets on a landing foot loft regolith; gas flow carries grains up a tube into a canister. This is not vacuum suction.</td></tr>
<tr><td>Returned material</td><td>At least 10 g target</td><td>Total mission target, not a guaranteed amount from each device. Two sampling sites are planned; the two techniques are not assigned one-to-one to separate sites.</td></tr>
</tbody></table></div>
<h2>Spacecraft configurations</h2><p>The three modules are propulsion, return and exploration. Outbound cruise uses all three. The propulsion module is discarded after Mars capture. At Phobos, the return module and the four-legged exploration module operate together; the pneumatic sampler is on a landing leg, and the corer is operated by the arm. The Earthbound vehicle is the return module, which releases its sample capsule near Earth.</p>
<h2>Data boundaries and projection</h2><p>The outbound line and Earth/Mars reference paths use the project’s archived <code>transfer.json</code> and DE440s context. A fixed 23.4392911° obliquity rotates the equatorial vectors to a mean-J2000 ecliptic basis. The drawing then rotates that plane −45° and foreshortens it vertically by 0.53. No actual post-splice capture path or 2030–2031 return trajectory is fabricated. See <a href="provenance.json">figure provenance</a>, <a href="../data/transfer_provenance.json">trajectory provenance</a> and <a href="sources.json">source notes</a>.</p>
<h2>Sources</h2><ol class="sources">__SOURCES__</ol>
<footer>Original vector illustration informed by the supplied JAXA mission-profile reference; no agency logo or source-image pixels are used. Illustration: Mickey.</footer></section></main>
<script>
const svg=document.querySelector('.plate svg'),tip=document.getElementById('tip');
for(const b of document.querySelectorAll('[data-box]')) b.addEventListener('click',()=>{svg.setAttribute('viewBox',b.dataset.box);const v=b.dataset.box.split(' ').map(Number);svg.style.aspectRatio=`${v[2]} / ${v[3]}`;for(const other of document.querySelectorAll('[data-box]'))other.setAttribute('aria-pressed',String(other===b));tip.hidden=true;});
const hide=()=>{tip.hidden=true;};
for(const el of svg.querySelectorAll('[data-tip]')){const show=e=>{tip.textContent=el.dataset.tip;tip.hidden=false;const r=el.getBoundingClientRect(),x=e.clientX||r.left,y=e.clientY||r.top;tip.style.left=`${Math.max(16,Math.min(innerWidth-tip.offsetWidth-16,x+14))}px`;tip.style.top=`${Math.max(16,Math.min(innerHeight-tip.offsetHeight-16,y+14))}px`;};el.addEventListener('pointerenter',show);el.addEventListener('pointermove',show);el.addEventListener('pointerleave',hide);el.addEventListener('focus',show);el.addEventListener('blur',hide);}
addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
</script></body></html>'''.replace('__SVG__',svg).replace('__SOURCES__',source_items)
(OUT/'index.html').write_text(page)
print(f'Wrote self-contained reading page: {OUT}/index.html')
