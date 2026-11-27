import numpy as np, wave, sys
SR=44100; DUR=float(sys.argv[2]); QS,QE=float(sys.argv[3]),float(sys.argv[4]); n=int(SR*DUR); out=np.zeros(n)
rng=np.random.default_rng(3); bpm=float(sys.argv[5]) if len(sys.argv)>5 else 82; beat=60/bpm
t=lambda d: np.arange(int(SR*d))/SR
def put(x,at,g=1):
    i=int(at*SR); j=min(n,i+len(x))
    if 0<=i<n: out[i:j]+=x[:j-i]*g
def kick():
    tt=t(.4); f=45+90*np.exp(-tt*25); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-tt*7)
def snare():
    tt=t(.25); x=rng.normal(0,1,len(tt)); x=np.convolve(x,np.ones(6)/6,'same'); return x*np.exp(-tt*16)*.35
def hat():
    tt=t(.05); x=np.diff(rng.normal(0,1,len(tt)),prepend=0); return x*np.exp(-tt*80)*.08
def pad(freqs,d):
    tt=t(d); env=np.minimum(1,tt/0.6)*np.minimum(1,(d-tt)/0.8)
    return sum(np.sin(2*np.pi*f*tt)*0.5+np.sin(2*np.pi*f*2.003*tt)*0.12 for f in freqs)*env*0.09
chords=[[220,261.6,329.6],[196,246.9,293.7],[174.6,220,261.6],[164.8,207.7,261.6]]
bar=beat*4; tm=0; k=0
while tm<DUR:
    if not(QS<=tm<QE): put(pad(chords[k%4],bar+0.3),tm)
    for s in range(8):
        at=tm+s*beat/2
        if QS<=at<QE or at>=DUR: continue
        if s in (0,2,4,6): put(kick(),at,.6)
        if s in (2,6): put(snare(),at,.6)
        put(hat(),at+0.012*(s%2),1)
    tm+=bar; k+=1
# vinyl crackle
cr=0
out=np.tanh(out*1.1)*0.6
f=int(SR*.05); out[-f:]*=np.linspace(1,0,f)
w=wave.open(sys.argv[1],'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes()); w.close()
