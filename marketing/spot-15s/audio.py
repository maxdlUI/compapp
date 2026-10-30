import numpy as np, wave
SR=48000; DUR=15.0; N=int(SR*DUR)
rng=np.random.default_rng(3)
L=np.zeros(N); Rr=np.zeros(N)
t=np.arange(N)/SR
def add(sig,start,gain=1.0,pan=0.0):
    i=int(start*SR); sig=sig[:max(0,N-i)]
    l=np.cos((pan+1)*np.pi/4); r=np.sin((pan+1)*np.pi/4)
    L[i:i+len(sig)]+=sig*gain*l*1.414; Rr[i:i+len(sig)]+=sig*gain*r*1.414
def lp(x,fc):
    fc=np.broadcast_to(fc,x.shape); a=1-np.exp(-2*np.pi*fc/SR); y=np.empty_like(x); s=0.0
    for i in range(len(x)): s+=a[i]*(x[i]-s); y[i]=s
    return y
def env(n,a,d):
    tt=np.arange(n)/SR; return np.minimum(1,tt/max(a,1e-4))*np.exp(-tt/d)
def kick(big=False):
    n=int(SR*(1.2 if big else .6)); tt=np.arange(n)/SR
    f=45+ (160 if big else 130)*np.exp(-tt*28); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*np.exp(-tt*(2.2 if big else 5.5))
    s+= rng.standard_normal(n)*np.exp(-tt*60)*.25
    return np.tanh(s*1.6)
def noise_sweep(dur,f0,f1,rev=False):
    n=int(SR*dur); x=rng.standard_normal(n); fc=np.geomspace(f0,f1,n)
    y=lp(x,fc)-lp(lp(x,fc*.35),fc*.35)*.6
    e=np.linspace(0,1,n)**2.2
    return y*e/np.max(np.abs(y)+1e-9)
def tone(freq,dur,a=.005,d=.2,wave='sine'):
    n=int(SR*dur); tt=np.arange(n)/SR; ph=2*np.pi*freq*tt
    s=np.sin(ph) if wave=='sine' else (2*((freq*tt)%1)-1)
    return s*env(n,a,d)
def saw(freq,n,det=(0,)):
    tt=np.arange(n)/SR; return sum(2*((freq*(1+d)*tt+k*.37)%1)-1 for k,d in enumerate(det))/len(det)

# --- pad: Am - F - C - G across 15s
chords=[(0,[220,261.63,329.63]),(3.75,[174.61,220,261.63]),(7.5,[261.63,329.63,392]),(10.0,[196,246.94,293.66])]
pad=np.zeros(N)
for k,(st,notes) in enumerate(chords):
    en=chords[k+1][0] if k+1<len(chords) else 12.4
    n=int((en-st)*SR)+int(.6*SR)
    s=sum(saw(f,n,(-.004,0,.005)) for f in notes)/3
    e=np.minimum(1,np.arange(n)/(SR*.4))*np.minimum(1,(n-np.arange(n))/(SR*.6))
    i=int(st*SR); pad[i:i+n]+= (s*e)[:N-i]
pad=lp(pad,900+500*np.sin(2*np.pi*t/7.5)**2)
add(pad*np.minimum(1,t/2.0),0,.16)

# --- intro drone + riser
drone=np.sin(2*np.pi*55*t)*np.minimum(1,t/1.2)*(t<2.5)
add(drone,0,.25)
add(noise_sweep(2.3,200,9000),0.1,.32)
add(tone(1760,.25,.001,.06),0.05,.18)

# --- beat 2.4 -> 12.4 (120 bpm)
bassnotes={2.4:55,3.75:43.65,5.0:55,6.25:43.65,7.5:65.41,8.75:65.41,10.0:49,11.25:49}
for b in np.arange(2.4,12.4,.5):
    add(kick(),b,.55)
    hn=int(SR*.06); h=rng.standard_normal(hn); h=h-lp(h,np.full(hn,6000.)); add(h*env(hn,.001,.018),b+.25,.18,pan=.3)
    if int((b-2.4)/.5)%2==1:
        sn=int(SR*.25); s=rng.standard_normal(sn); s=s-lp(s,np.full(sn,1500.)); add(s*env(sn,.001,.06),b,.22,pan=-.1)
    key=max(k for k in bassnotes if k<=b+1e-6); f=bassnotes[key]
    n=int(SR*.48); bs=lp(saw(f,n,(0,.006)),np.geomspace(1800,180,n))*env(n,.004,.25)
    add(np.tanh(bs*2),b,.35)
# 16th hats in the net damage / map part for energy
for b in np.arange(5.0,10.4,.125):
    hn=int(SR*.03); h=rng.standard_normal(hn); h=h-lp(h,np.full(hn,8000.)); add(h*env(hn,.001,.008),b,.07,pan=-.35)

# --- impacts
for h in [2.4,5.0,7.8,10.4]:
    add(kick(True),h,.7); add(noise_sweep(.5,6000,300)[::-1],h,.25)
# timer ticks
for k,tt in enumerate(np.arange(2.7,4.9,.25)):
    add(tone(2400 if k%4==0 else 1900,.05,.0005,.01),tt,.22,pan=-.4)
# chip pops
for i in range(5): add(tone(660*2**(i/7),.12,.001,.04),3.3+i*.07,.2,pan=.4)
# warning beeps
for d in (0,.16): add(tone(988,.12,.002,.06,'saw'),3.98+d,.10,pan=.4)
# whoosh into net damage
add(noise_sweep(.45,400,12000),4.6,.45)
# count-up blips
for k,tt in enumerate(np.cumsum(np.geomspace(.03,.11,18))+5.55):
    if tt<7.1: add(tone(1200+k*40,.04,.0005,.012),tt,.12,pan=.35)
# result sting
add(tone(880,.6,.002,.25)+tone(1318.5,.6,.002,.25)*.6,6.0,.12)
# map: sonar ping + dest pulse
add(tone(1046.5,1.2,.002,.4),8.3,.14); add(tone(1568,.8,.002,.3),9.7,.12,pan=.3)
# card whooshes
for i in range(4): add(noise_sweep(.18,800,7000)[::-1]*.7,10.62+i*.08,.18,pan=-.6+i*.4)
# pre-logo riser (reverse)
add(noise_sweep(1.2,150,14000),11.2,.55)
sw=np.sin(2*np.pi*np.cumsum(np.geomspace(60,300,int(SR*1.2)))/SR)*np.linspace(0,1,int(SR*1.2))**3
add(sw,11.2,.25)

# --- logo hit + shimmer
add(kick(True),12.4,.95)
n=int(SR*2.6); tt=np.arange(n)/SR
shimmer=sum(np.sin(2*np.pi*f*tt+p)*a for f,a,p in [(110,.5,0),(220,.4,1),(329.63,.3,2),(440,.3,0),(554.37,.25,1),(659.25,.25,2),(987.77,.15,0),(1318.5,.12,1)])
shimmer*=np.minimum(1,tt/.01)*np.exp(-tt/1.3)
add(shimmer,12.4,.32)
add(noise_sweep(.6,9000,200)[::-1],12.4,.3)
# sparkles on shine sweep / CTA
for k in range(8): add(tone(2637*2**(k%4/12*3),.18,.001,.07),13.75+k*.045,.07,pan=-.7+k*.2)
add(tone(1760,.5,.002,.2)+tone(2217,.5,.002,.2),13.85,.08)

# --- reverb (convolution)
def reverb(x,dur=1.8,mix=.22,seed=0):
    r=np.random.default_rng(seed); n=int(SR*dur); ir=r.standard_normal(n)*np.exp(-np.arange(n)/SR*4.0); ir=lp(ir,np.full(n,5000.)); ir/=np.sqrt(np.sum(ir**2))
    m=len(x)+n; F=2**int(np.ceil(np.log2(m)))
    y=np.fft.irfft(np.fft.rfft(x,F)*np.fft.rfft(ir,F),F)[:len(x)]
    return x+y*mix
L=reverb(L,seed=1); Rr=reverb(Rr,seed=2)
st=np.stack([L,Rr],1)
# fades + soft master limiter
fade=np.ones(N); fade[:int(.02*SR)]=np.linspace(0,1,int(.02*SR)); fade[-int(.6*SR):]=np.linspace(1,0,int(.6*SR))**1.5
st*=fade[:,None]
st/=np.percentile(np.abs(st),99.95)/0.9
st=np.tanh(st*1.1)/np.tanh(1.1)*.94
w=wave.open('audio.wav','wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st*32767).astype('<i2').tobytes()); w.close(); print('ok')
