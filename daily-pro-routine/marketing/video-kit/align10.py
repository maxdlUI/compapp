import sys, json
from pocketsphinx import Decoder
text = """youve played thousands of hours
so why arent you getting better
because playing isnt practice
pros dont train more they train in the right order
first precision slow clean edits zero mistakes
then speed same moves faster until you stop thinking about them
then pressure real fights only use what you just trained
most players start at step three every single day
thats why their mechanics never show up in fights
fifteen minutes this order every day
the full routine is free on repline
precision speed pressure"""
d = Decoder(lm=None)
for w,p in [x for x in [("youve","Y UW V"),("arent","AA R N T"),("isnt","IH Z AH N T"),("dont","D OW N T"),("repline","R EH P L AY N"),("fortnite","F AO R T N AY T"),("its","IH T S"),("theres","DH EH R Z"),("thats","DH AE T S")] if d.lookup_word(x[0]) is None]: d.add_word(w,p,True)
words=text.split(); print("missing",[w for w in set(words) if d.lookup_word(w) is None],file=sys.stderr)
d.set_align_text(" ".join(words))
raw=open(sys.argv[1],"rb").read()
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt(); d.set_alignment()
d.start_utt(); d.process_raw(raw, full_utt=True); d.end_utt()
out=[(s.name, round(s.start/100,2), round((s.start+s.duration)/100,2)) for s in d.get_alignment()]
json.dump(out, open(sys.argv[2],"w")); print(" ".join(f"{w}@{a}" for w,a,b in out))
