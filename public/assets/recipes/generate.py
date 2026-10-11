import json,subprocess,os
for folder in ['assets/recipes', 'assets/snake/head', 'assets/audio']:
 os.makedirs(folder,exist_ok=True)
def run(*a):
 r=subprocess.run(a,capture_output=True,text=True)
 if r.returncode: raise RuntimeError(r.stderr)
def rect(ops,x,y,w,h,c):ops.append(dict(op='fill_rect',x=x,y=y,width=w,height=h,color=c))
# Cross-section joins share exactly the same pixels at each cell edge.
colors=['#0b574fff','#219d83ff','#48e4b0ff','#b8ffe0ff']
for name in ['body','corner','tail']:
 ops=[]
 if name=='body':
  for y,h,c in [(7,18,colors[0]),(9,14,colors[1]),(11,10,colors[2]),(11,3,colors[3])]:rect(ops,0,y,32,h,c)
  for x in [5,17,29]:rect(ops,x,16,2,5,'#24b68fff')
 elif name=='corner':
  # quarter-annulus centered at lower-right: both connections join at y/x=7..24
  for y in range(32):
   for x in range(32):
    d=((31-x)**2+(31-y)**2)**.5
    if 7<=d<25:
     c=colors[0] if d<9 or d>=23 else colors[1] if d<11 or d>=21 else colors[3] if d>=18 else colors[2]
     rect(ops,x,y,1,1,c)
 else:
  for x in range(32):
   half=min(9,2+x//3)
   rect(ops,x,16-half,1,half*2,colors[0])
   if half>3:rect(ops,x,18-half,1,half*2-4,colors[1])
   if half>5:rect(ops,x,20-half,1,half*2-8,colors[2])
   if half>6:rect(ops,x,18-half,1,2,colors[3])
 path=f'assets/recipes/{name}.json';json.dump(ops,open(path,'w'),indent=2)
 run('draw','render','--actions',path,'--out',f'assets/snake/{name}.png','--width','32','--height','32','--no-layers')
for frame in range(4):
 ops=[]
 # tapered armored head, strong snout and rear connection
 for x,y,w,h,c in [(0,7,23,18,colors[0]),(4,4,18,24,colors[0]),(20,7,8,18,colors[0]),(27,10,4,12,colors[0]),(0,9,22,14,'#53e9baff'),(5,6,16,20,'#53e9baff'),(20,9,7,14,'#53e9baff'),(27,12,3,8,'#53e9baff'),(4,7,15,4,'#d8ffe9ff'),(19,10,5,3,'#d8ffe9ff'),(5,23,15,3,'#20a582ff'),(18,7,6,5,'#05292bff'),(20,7,3,3,'#ffffffff')]:rect(ops,x,y,w,h,c)
 opening=[1,4,8,3][frame]
 rect(ops,23,16-opening//2,9,opening,'#05292bff')
 if frame in [1,2,3]:
  rect(ops,24,16-opening//2,2,2,'#ffffffff');rect(ops,24,14+opening//2,2,2,'#ffffffff')
 if frame==2:rect(ops,25,16,7,2,'#ff738fff')
 path=f'assets/recipes/head-{frame}.json';json.dump(ops,open(path,'w'),indent=2)
 run('draw-sheet','render','--actions',path,'--out',f'assets/snake/head/{frame}.png','--width','32','--height','32','--no-layers')
for name,freq,dur in [('eat',720,65),('combo-up',1250,100),('death',130,650)]:
 cfg=f'assets/recipes/{name}-config.json'
 json.dump(dict(sample_rate=44100,channels='stereo',max_duration_ms=dur,seed=7,actions=f'assets/recipes/{name}-audio.json',preview=f'/tmp/{name}.png',wav=f'assets/audio/{name}.wav'),open(cfg,'w'),indent=2)
 def s(*a):run('sfx-synth','--config',cfg,*a)
 s('init');s('add-voice','--name','tone','--wave','triangle','--dur',str(dur),'--freq',str(freq),'--gain=-12')
 s('set-envelope','--voice','tone','--env','pluck')
 s('set-pitch','--voice','tone','--slide-to',str(freq*.45 if name=='death' else freq*1.5),'--over',str(dur))
 if name=='death':
  s('add-voice','--name','crack','--wave','noise','--dur','180','--gain=-21');s('set-envelope','--voice','crack','--env','pluck')
 s('render')
cfg='assets/recipes/music-config.json'
json.dump(dict(sample_rate=44100,channels='stereo',max_duration_ms=8000,seed=11,instrument_bank='synthwave',actions='assets/recipes/music.json',preview='/tmp/music.png',wav='assets/audio/music.wav',midi='assets/audio/music.mid'),open(cfg,'w'),indent=2)
def m(*a):run('music','--config',cfg,*a)
m('init');m('set-tempo','--bpm','120')
for track,wave,gain in [('bass','triangle','-22'),('pulse','sine','-29'),('air','triangle','-31')]:
 m('define-track','--name',track,'--instrument',wave);m('set-track-fx','--track',track,'--gain',gain,'--env','pluck')
for i in range(16):
 root=[45,41,48,43][i//4]
 m('add-note','--track','bass','--pitch',str(root),'--t',str(i),'--dur','0.75','--velocity','85')
 for j in range(2):m('add-note','--track','pulse','--pitch',str(root+12+[0,7,12,7][(i*2+j)%4]),'--t',str(i+j*.5),'--dur','0.35','--velocity','65')
 if i%2==0:m('add-note','--track','air','--pitch',str(root+24),'--t',str(i),'--dur','1.5','--velocity','45')
m('render')

# The sequencer ends at the last note tail. Pad to the exact sixteen-beat
# boundary, keeping the eighth-second rest that closes the repeating phrase.
import wave
with wave.open('assets/audio/music.wav', 'rb') as w:
 params = w.getparams()
 data = w.readframes(w.getnframes())
 count = w.getnframes()
with wave.open('assets/audio/music.wav', 'wb') as w:
 w.setparams(params)
 w.writeframes(data + b'\0' * ((44100 * 8 - count) * params.nchannels * params.sampwidth))
# The tool's default MIDI filename is clip.mid.
if os.path.exists('clip.mid'):
 os.replace('clip.mid', 'assets/audio/music.mid')
if os.path.exists('layers.json'):
 os.remove('layers.json')
