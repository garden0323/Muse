"""MUSE original scrapbook SVG illustrations. No third-party or emoji assets."""
from pathlib import Path
import json, math
out=Path('dist/assets/stickers');out.mkdir(parents=True,exist_ok=True)
C={'green':'#91a877','dark':'#617749','pink':'#d9a6a0','rose':'#b9787b','yellow':'#e9c578','blue':'#99b8c0','brown':'#b19473','paper':'#f7edda','ink':'#59604c','orange':'#cf9e70'}
def P(d,c='paper',extra=''):return f'<path d="{d}" fill="{C.get(c,c)}" {extra}/>'
def L(d):return f'<path d="{d}" fill="none"/>'
def E(x,y,rx,ry,c='paper'):return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{C.get(c,c)}"/>'
def R(x,y,w,h,c='paper',r=5):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{C.get(c,c)}"/>'
def star(cx,cy,r=24,n=5,inner=.46,c='yellow'):
 pts=[]
 for i in range(n*2):
  a=math.pi*i/n-math.pi/2;k=r if i%2==0 else r*inner;pts.append(f'{cx+math.cos(a)*k:.2f},{cy+math.sin(a)*k:.2f}')
 return f'<polygon points="{" ".join(pts)}" fill="{C.get(c,c)}"/>'
def heart(x=64,y=62,scale=1,c='pink'):return f'<g transform="translate({x} {y}) scale({scale})">'+P('M0 26C-55-6-25-48 0-19C25-48 55-6 0 26Z',c)+'</g>'
def stem():return L('M64 105Q57 76 68 44')+P('M63 87Q27 88 34 64Q55 65 63 87Z','green')+P('M65 72Q93 72 94 50Q73 53 65 72Z','green')
def face(shape,eyes=None,mouth=None):return shape+(eyes or E(49,61,3,4,'ink')+E(79,61,3,4,'ink'))+(mouth or L('M52 80Q64 90 77 79'))+E(38,74,7,3,'pink')+E(90,74,7,3,'pink')
def animal(shape,eyes=None,mouth=None):return face(shape,eyes,mouth)
def petals(cx,cy,n,r=24,c='pink'):
 return ''.join(f'<g transform="rotate({i*360/n} {cx} {cy})">'+E(cx,cy-r*.7,r*.31,r*.65,c)+'</g>' for i in range(n))+E(cx,cy,9,9,'yellow')
A=[]
def add(cat,id,name,art):A.append({'id':id,'name':name,'category':cat});svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128"><defs><g id="art">'+art+'</g></defs><g stroke-linecap="round" stroke-linejoin="round"><use href="#art" stroke="#fffdf5" stroke-width="9"/><use href="#art" stroke="#59604c" stroke-width="2.2"/></g></svg>';(out/(id+'.svg')).write_text(svg)
# 15 botanical silhouettes, each drawn independently.
cat='nature'
add(cat,'tulip','튤립',stem()+P('M42 31L52 42L65 21L78 41L89 30Q91 66 66 67Q42 64 42 31Z','pink'))
add(cat,'daisy','데이지',stem()+petals(64,42,8,26,'paper'))
add(cat,'sunflower','해바라기',stem()+petals(64,42,12,29,'yellow')+E(64,42,14,14,'brown'))
add(cat,'rose','장미',stem()+P('M40 42L43 27L60 24L72 20L91 35L86 57L67 65L44 58Z','rose')+L('M48 32Q77 27 78 45Q63 61 52 44Q55 34 68 40L64 48'))
add(cat,'lavender','라벤더',L('M46 108L61 32M73 109L78 43')+''.join(E(57+(i%2)*11,31+i*9,7,5,'#ac9ab6') for i in range(7))+''.join(E(74+(i%2)*8,43+i*9,6,4,'#ac9ab6') for i in range(6)))
add(cat,'clover','네잎클로버',L('M64 73Q63 98 48 110')+''.join(f'<g transform="rotate({a} 64 62)">'+heart(64,43,.55,'green')+'</g>' for a in [0,90,180,270]))
add(cat,'ginkgo','은행잎',P('M63 87Q25 81 18 46Q40 38 45 24Q59 35 66 22Q77 39 108 44Q105 78 63 87Z','yellow')+L('M63 87L57 111M63 87L30 49M63 87L49 37M63 87L67 34M63 87L94 48'))
add(cat,'monstera','몬스테라',P('M66 96Q17 86 25 45Q33 15 65 26Q98 8 108 41Q114 82 66 96Z','green')+L('M65 111L65 39M65 60L37 45M65 74L31 66M65 84L90 64M65 56L91 33')+E(46,43,4,9,'paper')+E(87,49,4,8,'paper'))
add(cat,'pine','소나무',R(58,83,13,29,'brown',1)+P('M64 17L91 48H78L106 79H87L113 96H17L40 77H23L49 48H36Z','dark'))
add(cat,'cactus','선인장',R(50,29,28,70,'green',13)+P('M50 61H36V46Q25 40 24 50V70Q24 81 50 80Z','green')+P('M78 73H94V55Q104 48 108 58V83Q108 93 78 92Z','green')+R(41,96,48,17,'orange',3)+L('M62 38V88M53 49H58M69 65H76')+petals(66,25,5,12,'pink'))
add(cat,'mushroom','버섯',P('M54 61L47 103Q64 115 80 101L74 61Z','paper')+P('M17 66Q33 11 66 19Q99 15 112 67Q70 80 17 66Z','rose')+E(42,48,8,7,'paper')+E(76,38,8,6,'paper')+E(94,59,5,4,'paper'))
add(cat,'strawberry','딸기',P('M30 48Q65 27 100 47Q100 86 65 111Q29 89 30 48Z','rose')+P('M64 48L34 32L54 33L66 17L74 36L101 31L85 49L66 42Z','green')+''.join(L(f'M{x} {y}l-2 5') for x,y in [(46,60),(67,61),(86,61),(55,80),(77,80),(64,96)]))
add(cat,'lemon','레몬',P('M22 62Q33 18 78 27L100 26L104 46Q114 91 69 105L47 100L24 102L24 84Z','yellow')+L('M40 49Q51 37 70 36')+P('M83 27Q79 9 105 11Q110 28 83 27Z','green'))
add(cat,'acorn','도토리',P('M37 57Q31 97 65 110Q98 96 92 56Z','brown')+P('M27 62Q26 29 64 31Q100 29 102 62Z','dark')+L('M65 32Q62 17 75 14M34 47L45 57L57 43L70 57L82 43L96 52'))
add(cat,'sprout','새싹',L('M66 109L64 51')+P('M64 72Q22 76 18 37Q63 31 64 72Z','green')+P('M65 52Q66 11 107 22Q105 56 65 52Z','dark')+E(65,111,38,5,'brown'))
# 15 animals with distinct silhouettes and details.
cat='animals'
add(cat,'cat','고양이',animal(P('M29 47L25 16L50 32Q65 26 79 32L104 16L100 49Q120 106 65 110Q10 107 29 47Z','paper'))+L('M26 73L8 68M27 82L8 85M101 73L119 68M100 83L119 86')+P('M59 71L70 71L64 77Z','pink'))
add(cat,'dog','강아지',P('M36 35Q13 19 10 52Q8 86 31 77Z','brown')+P('M91 34Q117 18 120 54Q120 85 97 78Z','brown')+animal(E(64,66,38,43,'paper'))+E(64,76,12,9,'brown')+P('M58 86Q64 109 71 86Z','pink'))
add(cat,'rabbit','토끼',E(43,33,12,29,'paper')+E(83,31,12,29,'paper')+E(44,31,4,19,'pink')+E(82,31,4,19,'pink')+animal(E(64,78,37,33,'paper'))+P('M59 82L69 82L64 88Z','pink'))
add(cat,'bear','곰',E(30,32,16,17,'brown')+E(98,32,16,17,'brown')+animal(E(64,69,45,43,'brown'))+E(64,81,19,13,'paper')+E(64,76,6,4,'ink'))
add(cat,'fox','여우',animal(P('M18 21L50 39L65 33L80 39L111 20L105 73L65 111L21 75Z','orange'))+P('M25 66L58 75L65 103L72 75L103 66L96 89L65 113L33 91Z','paper')+E(64,90,6,4,'ink'))
add(cat,'panda','판다',E(31,28,16,15,'ink')+E(97,28,16,15,'ink')+animal(E(64,68,45,44,'paper'),E(45,60,12,16,'ink')+E(83,60,12,16,'ink')+E(46,59,3,4,'paper')+E(82,59,3,4,'paper'))+E(64,79,7,4,'ink'))
add(cat,'penguin','펭귄',P('M32 67Q18 101 12 89Q11 65 36 49Z','blue')+P('M96 67Q110 100 117 89Q115 64 92 49Z','blue')+E(64,63,34,48,'blue')+E(64,78,26,32,'paper')+E(51,46,3,4,'ink')+E(78,46,3,4,'ink')+P('M54 56H74L64 69Z','orange')+E(46,111,14,6,'yellow')+E(83,111,14,6,'yellow'))
add(cat,'duck','오리',P('M30 68Q23 97 56 107Q104 114 112 68L92 78L76 71Q103 34 77 23Q48 12 43 43L20 49L44 59Z','yellow')+E(70,43,3,4,'ink')+L('M53 83Q73 98 91 83')+P('M43 43L19 48L43 59Z','orange'))
add(cat,'whale','고래',P('M19 73Q17 38 60 41Q95 46 102 69L114 55L121 83L101 91Q83 112 42 101Q15 95 19 73Z','blue')+E(46,68,3,3,'ink')+L('M30 80Q44 89 56 82M58 36V19M55 26Q43 14 37 22M61 25Q72 13 80 19')+P('M64 88L79 99L84 79Z','blue'))
add(cat,'hedgehog','고슴도치',P('M21 84L12 67L28 61L20 43L40 44L43 26L60 37L76 21L84 40L105 37L103 61L115 76L102 97L35 104Z','brown')+P('M31 80Q29 52 62 58L108 86L98 104H41Z','paper')+E(81,80,3,3,'ink')+E(109,86,6,5,'ink'))
add(cat,'squirrel','다람쥐',P('M71 86Q116 112 117 62Q119 18 88 24Q69 34 88 55Q110 71 90 81Z','orange')+E(50,83,23,31,'orange')+E(47,47,24,21,'orange')+P('M29 36L30 17L44 30M49 28L65 15L66 40','orange')+E(38,47,3,3,'ink')+P('M33 83Q52 69 65 87L53 105Z','brown')+E(51,79,15,5,'dark'))
add(cat,'owl','부엉이',P('M27 22L48 34L79 34L103 22L100 80Q99 110 64 112Q27 107 28 80Z','brown')+E(46,56,21,22,'paper')+E(83,56,21,22,'paper')+E(46,57,6,8,'ink')+E(83,57,6,8,'ink')+P('M58 74H71L65 85Z','yellow')+L('M46 95L51 99L56 95M70 96L75 100L80 96'))
add(cat,'butterfly','나비',P('M62 59Q30 0 12 31Q9 58 45 67Q14 82 33 103Q52 115 64 77Q84 115 103 100Q119 78 84 67Q125 50 110 25Q92 6 68 60Z','pink')+E(65,70,5,28,'brown')+L('M64 43L54 27M67 43L78 25')+E(36,42,10,10,'yellow')+E(96,40,10,10,'blue'))
add(cat,'fish','물고기',P('M28 62Q59 16 101 61Q71 108 29 66L12 88V39Z','blue')+E(88,58,4,4,'ink')+L('M74 42Q63 63 74 82M47 49L59 61L47 75')+P('M55 36L64 19L77 36Z','pink'))
add(cat,'snail','달팽이',P('M18 102Q14 84 46 85H86L96 59Q116 54 115 75L111 98L101 111H27Z','green')+E(56,66,34,35,'brown')+L('M73 67Q68 42 47 46Q26 56 39 76Q57 92 67 71Q73 58 56 56Q42 58 47 69')+L('M99 60L92 42M110 61L117 43')+E(92,41,4,4,'paper')+E(117,42,4,4,'paper'))
# 15 feelings and expressive paper companions.
cat='feelings';base=E(64,65,45,44,'yellow')
add(cat,'heart-letter','하트 편지',R(16,38,96,68,'paper')+L('M17 40L64 79L111 40M18 104L48 74M110 104L81 75')+heart(64,34,.6,'rose'))
add(cat,'smile','미소 얼굴',face(base))
add(cat,'laugh','눈웃음',face(base,L('M36 61Q46 47 55 60M73 60Q82 47 93 61'),P('M43 76Q64 104 85 75Z','rose')))
add(cat,'tear','눈물 얼굴',face(base,L('M37 57L55 61M74 61L92 56'),L('M51 88Q64 76 78 88'))+P('M90 66Q75 91 91 95Q105 91 90 66Z','blue'))
add(cat,'surprise','놀란 얼굴',face(base,E(48,58,6,8,'paper')+E(80,58,6,8,'paper'),E(64,85,9,12,'rose')))
add(cat,'sleepy','졸린 얼굴',face(base,L('M35 61Q45 70 55 61M74 61Q83 70 93 61'),E(64,83,6,8,'rose'))+L('M91 20H109L90 34H110M104 8H117L104 18H117'))
add(cat,'wink','윙크',face(base,E(48,61,4,5,'ink')+L('M75 57L87 63L75 67')))
add(cat,'grumpy','화난 표정',face(base,L('M35 50L56 60M73 60L94 50')+E(49,65,3,4,'ink')+E(79,65,3,4,'ink'),L('M48 89Q64 76 82 89'))+L('M97 15V31M89 23H106'))
add(cat,'double-heart','두근 하트',heart(49,66,1,'rose')+heart(88,41,.6,'pink')+L('M14 31L5 22M26 20L22 9M107 80L120 84'))
add(cat,'star-eyes','별눈 표정',face(base,star(47,58,14,c='rose')+star(83,58,14,c='rose'),P('M46 79Q65 103 85 78Z','paper')))
add(cat,'hello-bubble','인사 말풍선',P('M19 25H107V83H63L37 106V83H19Z','paper')+L('M38 44V66M52 44V66M38 55H52M70 47V65M70 39V40M87 44V58M87 66V67'))
add(cat,'thought','생각 구름',P('M25 73Q5 57 24 44Q15 24 40 25Q53 7 70 24Q93 11 100 34Q125 37 108 61Q112 85 87 83Q68 101 49 83Q31 90 25 73Z','paper')+E(25,99,8,7,'paper')+E(12,116,4,4,'paper')+L('M45 55H45M65 55H65M85 55H85'))
add(cat,'thumb-up','엄지척',P('M31 66L51 45L57 17Q73 13 75 26L72 50H101Q114 52 110 67L100 100Q96 110 82 109L42 104L31 95Z','paper')+R(17,65,21,42,'blue',3)+L('M77 66H106M75 80H103M72 94H100'))
add(cat,'peace-hand','브이 손',P('M35 69L26 30Q28 19 39 25L55 61L66 17Q72 7 81 16L75 65Q102 58 105 77L98 104L75 117L47 112L34 93Z','paper')+L('M45 73Q68 60 77 81L61 96M76 65L82 85'))
add(cat,'hug','포옹',heart(64,64,1.35,'pink')+P('M15 63Q39 46 53 79L75 92Q54 111 34 91Z','paper')+P('M113 63Q90 46 76 79L53 92Q75 110 95 91Z','paper')+L('M49 42Q53 47 57 42M72 42Q76 47 80 42'))
# 20 real scrapbook objects.
cat='stationery'
add(cat,'washi','마스킹테이프',P('M9 41L23 34L109 29L116 40L109 51L118 63L111 81L16 89L11 76L19 62Z','yellow')+L('M30 42L42 78M52 38L65 77M77 36L90 75'))
add(cat,'torn-tape','찢어진 테이프',P('M18 30L35 37L52 31L69 37L88 29L110 36L103 50L111 64L101 78L110 94L91 90L73 98L54 91L35 99L16 93L24 77L16 63L24 46Z','pink')+L('M34 58L88 55M37 73L84 71'))
add(cat,'memo','메모지',P('M20 19L107 23L102 108L17 102Z','yellow')+L('M33 46L92 49M31 63L91 66M30 81L75 83')+P('M51 12L78 15L77 32L49 29Z','paper'))
add(cat,'folded-note','접힌 종이',P('M24 17H81L107 43V109H24Z','paper')+P('M81 17V43H107Z','blue')+L('M38 60H88M38 75H83M38 90H71'))
add(cat,'notebook','노트 조각',R(25,15,80,97,'paper',2)+L('M39 20V106M47 39H93M47 56H93M47 73H93M47 90H78')+''.join(E(26,y,5,3,'brown') for y in [28,47,66,85,104]))
add(cat,'envelope','편지봉투',P('M14 37H112V102H14Z','paper')+P('M14 37L64 78L112 37Z','pink')+L('M14 102L48 69M112 102L81 69')+E(65,77,10,10,'rose'))
add(cat,'postage','우표',P('M20 16L30 20L40 16L50 20L60 16L70 20L80 16L90 20L104 16V108L92 104L80 108L68 104L56 108L44 104L32 108L20 104Z','paper')+R(30,28,64,67,'blue',1)+P('M33 89L50 55L65 73L78 45L92 89Z','green')+E(47,43,8,8,'yellow'))
add(cat,'polaroid','폴라로이드',P('M22 17L109 25L99 113L12 105Z','paper')+P('M31 29L96 35L89 86L24 80Z','blue')+E(77,48,9,9,'yellow')+P('M24 79L47 51L63 71L77 60L89 86Z','green')+L('M30 96L77 100'))
add(cat,'film','필름 스트립',R(24,8,80,112,'ink',3)+R(36,18,56,38,'blue',0)+R(36,67,56,38,'pink',0)+''.join(R(x,y,5,7,'paper',1) for x in [27,96] for y in [17,32,47,65,80,95,110]))
add(cat,'paperclip','종이클립',L('M45 85V35Q45 16 65 16Q85 16 85 35V92Q85 117 58 117Q32 116 32 92V45Q32 31 44 31M58 42V92Q58 102 68 99Q73 98 73 90V36'))
add(cat,'binder','집게',P('M29 51H99L110 105H18Z','blue')+L('M42 61L36 29Q38 9 57 14L63 47M85 61L92 29Q89 9 72 14L65 47')+R(20,91,88,17,'dark',2))
add(cat,'pushpin','압정',L('M64 76L48 116')+P('M44 24L86 37L77 65L93 80L37 65L54 56Z','rose')+E(66,29,24,10,'pink'))
add(cat,'safety-pin','안전핀',L('M40 94L91 38Q110 13 89 10Q76 8 66 27L25 91Q12 115 37 116Q52 117 58 104L100 41')+P('M75 48L105 61L114 41L92 29Z','yellow'))
add(cat,'bow','리본 매듭',P('M54 56Q7 13 13 61Q11 98 55 73L33 116L64 99L95 117L75 73Q119 98 115 60Q119 13 74 55Z','pink')+E(64,64,14,18,'rose')+L('M21 46L48 60M104 47L81 61M58 83L48 102M71 83L81 102'))
add(cat,'rosette','로제트',P('M43 72L28 118L57 106L65 117L76 75Z','pink')+P('M65 77L79 115L91 102L110 112L91 67Z','rose')+star(65,51,40,12,.78,'yellow')+E(65,51,25,25,'paper')+star(65,51,16,c='pink'))
add(cat,'bunting','가랜드',L('M8 28Q64 58 120 27')+P('M17 33L38 41L18 70Z','pink')+P('M44 43L65 45L57 80Z','yellow')+P('M75 43L96 37L94 72Z','blue')+P('M102 35L118 28L118 57Z','green'))
add(cat,'ticket','입장 티켓',P('M14 34H112V48Q94 59 112 72V95H14V72Q31 60 14 48Z','yellow')+L('M83 39V46M83 52V58M83 64V70M83 76V83M83 89V93M29 51H67M29 65H61M29 80H52'))
add(cat,'bookmark','책갈피',P('M37 16H92V115L64 94L37 115Z','blue')+E(64,31,5,5,'paper')+L('M64 26Q43 8 57 8Q73 9 64 26')+star(64,64,18,c='yellow'))
add(cat,'stamp','고무 스탬프',R(23,86,83,26,'brown',4)+P('M35 86L45 64H82L95 86Z','paper')+P('M47 64Q34 24 64 20Q95 26 81 64Z','dark')+L('M31 104H97'))
add(cat,'pencil','연필',P('M19 106L31 75L91 15L111 35L51 95Z','yellow')+P('M19 106L31 75L51 95Z','paper')+P('M19 106L24 92L33 101Z','ink')+P('M84 22L96 10Q103 8 114 23L112 35L103 43Z','pink')+L('M37 81L98 27'))
# 15 everyday objects, no enlarged UI glyphs.
cat='everyday'
add(cat,'book','책',P('M11 25Q38 13 64 30Q90 13 117 25V103Q90 91 64 109Q38 91 11 103Z','paper')+L('M64 30V109M22 42Q41 35 54 43M22 60Q41 54 54 61M75 44Q94 36 106 42M75 62Q94 54 106 60')+P('M83 22V72L92 63L101 70V20Z','pink'))
add(cat,'camera','필름 카메라',R(13,39,104,66,'brown',10)+P('M37 39L45 24H81L89 39Z','paper')+E(66,73,27,27,'ink')+E(66,73,19,19,'blue')+E(60,67,6,6,'paper')+R(93,48,14,10,'yellow',2)+R(20,29,18,10,'dark',2))
add(cat,'coffee','커피 머그',L('M92 52Q124 46 114 73Q108 89 93 80')+P('M25 42H96V94Q63 111 29 94Z','paper')+E(60,43,36,10,'brown')+L('M43 30Q34 18 45 10M62 29Q54 16 67 8M82 30Q75 17 85 11'))
add(cat,'headphones','헤드폰',P('M23 69Q19 15 64 14Q111 16 106 70H96Q94 27 64 27Q33 28 34 69Z','brown')+R(16,59,26,46,'blue',10)+R(88,59,26,46,'blue',10)+L('M27 70V94M101 70V94'))
add(cat,'record-player','레코드 플레이어',R(14,40,101,65,'brown',6)+E(55,72,27,27,'ink')+E(55,72,10,10,'pink')+L('M99 52L91 84L75 89')+E(99,51,6,6,'paper')+R(17,21,94,18,'paper',4))
add(cat,'bag','캔버스 가방',P('M29 46H101L109 111H21Z','paper')+L('M44 55V30Q64 6 86 30V55')+R(40,68,48,32,'green',2)+heart(64,84,.35,'pink'))
add(cat,'sneaker','운동화',P('M16 58L43 36L67 68L104 80Q119 89 115 106H12Z','blue')+R(12,99,105,13,'paper',3)+L('M37 59L58 50M47 70L66 61M58 78L76 70M87 85L93 102'))
add(cat,'bicycle','자전거',E(29,86,23,23,'paper')+E(101,86,23,23,'paper')+L('M29 86L48 48L70 86H29L76 49L100 86M70 86L49 40M39 40H58M76 49L82 29H100')+E(70,86,5,5,'yellow'))
add(cat,'lamp','책상 램프',E(64,111,37,7,'brown')+L('M62 108L43 72L77 44')+P('M51 42L76 16L104 44L89 63Z','green')+E(91,56,13,7,'yellow'))
add(cat,'clock','알람 시계',E(64,70,39,37,'paper')+E(32,25,20,11,'pink')+E(96,25,20,11,'pink')+L('M41 106L32 119M86 107L95 118M64 45V72L83 81M64 13V25')+E(64,70,3,3,'ink'))
add(cat,'window','작은 창문',R(19,15,90,98,'brown',10)+R(28,24,72,80,'blue',5)+E(83,42,11,11,'yellow')+L('M64 24V104M29 64H100')+P('M8 17L37 18L27 108L11 111Z','paper')+P('M119 17L91 18L101 108L117 111Z','paper'))
add(cat,'cake','딸기 케이크',P('M23 57L101 43V100L23 112Z','paper')+P('M23 57L69 17L101 43Z','pink')+L('M23 81L101 67M23 98L101 84')+P('M59 27Q57 8 72 12Q87 10 82 27L72 38Z','rose')+P('M63 13L72 5L82 14Z','green'))
add(cat,'toast','버터 토스트',P('M30 111V59Q6 39 29 23Q62 2 99 22Q122 39 98 59V111Z','brown')+P('M39 101V54Q21 39 38 30Q65 16 91 32Q105 42 89 54V101Z','yellow')+R(48,58,31,26,'paper',3)+L('M41 92Q51 87 57 91'))
add(cat,'vase','꽃병',P('M42 64H86Q74 85 98 105Q65 122 30 105Q54 85 42 64Z','blue')+L('M63 67L50 28M68 67L89 30M60 67L29 44')+petals(49,25,5,16,'pink')+petals(91,27,6,16,'yellow')+P('M39 52Q14 59 17 35Q34 32 39 52Z','green'))
add(cat,'key','빈티지 열쇠',E(44,41,26,26,'yellow')+E(44,41,11,11,'paper')+P('M56 62L94 111L110 99L100 86L90 94L82 82L90 73L76 55Z','yellow'))
# 10 weather/season pieces.
cat='weather'
add(cat,'sun','햇살',E(64,64,26,26,'yellow')+''.join(L(f'M{64+math.cos(a)*36:.1f} {64+math.sin(a)*36:.1f}L{64+math.cos(a)*49:.1f} {64+math.sin(a)*49:.1f}') for a in [i*math.pi/6 for i in range(12)]))
add(cat,'crescent','초승달',P('M91 16Q37 11 24 59Q18 109 81 114Q101 111 111 96Q68 97 58 65Q48 33 91 16Z','yellow')+star(91,47,12,c='paper'))
add(cat,'saturn','토성',E(64,61,31,31,'pink')+f'<ellipse cx="64" cy="64" rx="56" ry="14" transform="rotate(-28 64 64)" fill="none"/>'+L('M45 40Q61 46 79 39M45 53Q62 59 87 52'))
add(cat,'cloud','뭉게구름',P('M24 93Q1 86 11 66Q16 52 32 56Q28 30 52 27Q76 22 84 44Q110 37 116 62Q132 87 106 94Z','paper')+L('M31 82H91'))
add(cat,'rain','소나기',P('M24 72Q3 64 15 45Q21 37 35 41Q35 18 59 21Q78 19 86 38Q115 30 118 57Q117 73 98 73Z','blue')+L('M34 87L25 107M61 86L52 106M88 86L79 106M110 88L101 108'))
add(cat,'snowflake','눈결정', ''.join(f'<g transform="rotate({a} 64 64)">'+L('M64 64V14M64 33L51 22M64 33L77 22M64 48L52 39M64 48L76 39')+'</g>' for a in range(0,360,60)))
add(cat,'rainbow','무지개',P('M12 104V70Q64-12 116 70V104H97V72Q64 16 31 72V104Z','rose')+P('M30 104V73Q64 15 98 73V104H82V75Q64 40 46 75V104Z','yellow')+P('M46 104V75Q64 39 82 75V104H68V79Q64 71 60 79V104Z','green'))
add(cat,'lightning','번개',P('M59 12H98L77 51H107L39 120L54 76H24Z','yellow'))
add(cat,'snowman','눈사람',E(64,87,35,30,'paper')+E(64,43,24,24,'paper')+R(42,12,44,15,'brown',2)+R(34,26,60,8,'brown',2)+P('M62 44L85 52L62 55Z','orange')+L('M53 42H53M73 41H73M30 75L9 61M97 75L118 58M64 79V80M64 94V95')+P('M39 62L87 61L81 75L65 74L76 101L62 106L51 75L40 75Z','pink'))
add(cat,'umbrella','우산',P('M10 70Q64-13 118 70Q100 56 82 70Q64 55 46 70Q27 56 10 70Z','pink')+L('M64 32V104Q52 126 42 108M64 32Q46 45 46 70M64 32Q83 47 82 70M64 20V29'))
# 10 marks with distinct contours and compositions.
cat='symbols'
add(cat,'curved-arrow','곡선 화살표',L('M16 97Q13 22 94 32')+P('M77 12L111 35L78 56Z','green'))
add(cat,'double-arrow','양방향 화살표',P('M8 64L38 32V51H89V32L120 64L89 96V77H38V96Z','blue'))
add(cat,'constellation','별 무리',star(39,41,28,c='yellow')+star(91,61,20,c='pink')+star(48,99,17,c='green')+L('M54 57L78 61M82 75L59 91'))
add(cat,'sparkles','반짝임',P('M68 17Q67 62 108 64Q69 66 68 111Q66 66 27 64Q66 62 68 17Z','yellow')+star(24,28,12,4,.3,'pink')+star(107,105,10,4,.3,'green'))
add(cat,'waves','물결 리본',L('M10 39Q23 14 37 39T65 39T93 39T120 39M10 66Q23 41 37 66T65 66T93 66T120 66M10 93Q23 68 37 93T65 93T93 93T120 93'))
add(cat,'gingham','깅엄 패치',P('M20 18L109 22L105 111L17 106Z','paper')+''.join(R(x,24,10,78,'pink',0) for x in [29,55,81])+''.join(R(23,y,77,8,'pink',0) for y in [37,64,91]))
add(cat,'heart-frame','하트 테두리',heart(64,62,1.6,'rose')+heart(64,62,1.18,'paper'))
add(cat,'star-frame','별 테두리',star(64,64,51,c='green')+star(64,64,36,c='paper'))
add(cat,'oval-frame','타원 액자',E(64,64,43,54,'brown')+E(64,64,33,43,'paper')+E(64,64,29,39,'paper')+L('M30 26L22 20M99 26L107 20M30 104L22 111M99 104L107 111'))
add(cat,'stitched-frame','스티치 테두리',R(13,24,103,80,'paper',15)+f'<rect x="23" y="34" width="83" height="60" rx="8" fill="none" stroke-dasharray="5 5"/>')
groups=[{'id':k,'name':n} for k,n in [('nature','자연·식물'),('animals','동물'),('feelings','감정·표정'),('stationery','문구·꾸미기'),('everyday','일상·소품'),('weather','계절·날씨'),('symbols','기호·장식')]]
assert len(A)==100 and len({a['id'] for a in A})==100
catalog={'groups':groups,'items':A}
Path('dist/sticker-catalog.js').write_text('(function(r){const c='+json.dumps(catalog,ensure_ascii=False,separators=(',',':'))+';if(typeof module===\'object\')module.exports=c;else r.MuseStickerCatalog=c})(globalThis);\n')
print('Generated',len(A),'original SVG stickers; bytes',sum(p.stat().st_size for p in out.glob('*.svg')))
