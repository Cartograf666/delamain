from PIL import Image,ImageDraw,ImageFont
from pathlib import Path
p=Path('./work/shots')
w,h=1280,720
out=Image.new('RGB',(w*2,3*(h+38)),(6,6,16));d=ImageDraw.Draw(out)
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',19)
for row,(view,label) in enumerate([('full','FULL / HOME'),('plaza','PLAZA / 3x'),('towers','TOWERS / 6x')]):
 for col,kind in enumerate(['prototype','gl']):
  img=Image.open(p/f'gl-{kind}-{view}.png').convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
  out.paste(img,(col*w,row*(h+38)+38));d.text((col*w+20,row*(h+38)+10),f'{kind.upper()} | {label}',font=font,fill=(190,210,235))
out.save(p/'gl-vs-prototype.png')
