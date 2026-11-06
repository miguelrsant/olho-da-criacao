/* Motor do site: WebGL2 em dois passos (cena numa grade → cada célula vira uma letra do atlas)
   e GSAP para as legendas. Portado do script do index.html original; roda uma vez, depois que o
   React monta o DOM. Os ids e atributos data-* que ele procura estão em App.jsx. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

// o código original usa window.gsap etc. (vindos da CDN); aqui eles vêm do npm
Object.assign(window, { gsap, ScrollTrigger, ScrambleTextPlugin });

let started = false;

/** FRESCO: { id: { src, w, h, mask? } }, afrescos de Michelangelo no teto da Capela Sistina (1508–1512).
    Os pontos de cada cena ficam em PTS, em coordenadas uv (0 a 1) da imagem. */
export function startSite(FRESCO) {
if (started) return;
started = true;
const HAS_LUZ = !!FRESCO.luz;
// enquanto um afresco não chega, a Criação de Adão ocupa o lugar dele (só nos testes)
for (const id of ['eva', 'pecado']) if (!FRESCO[id]) FRESCO[id] = { ...FRESCO.adao, mask: null, standin: true };
// light: [u, v, raio em fração da largura]; sword: punho (u, v) → ponta (u, v)
// tom das letras: [expoente da curva, ganho com ombro suave, normalização da cor, brilho]; o afresco vale por célula
const TONE = { eye: [1, 1.04, .5, .32], fresco: [.85, 1.3, .7, .4] };
const PTS = {
  adao: { tipA: [496 / 1200, 281 / 608], tipG: [523 / 1200, 277 / 608], all: [.43, .5], adam: [.17, .5], god: [.7, .4] },
  luz: { all: [.5, .3], mobAll: [.5, .42], god: [.56, .42], light: [.56, .2, .24] },
  eva: { all: [.5, .5], mobAll: [.47, .42], adam: [.22, .62], eve: [.5, .3], eveGod: [.6, .27], eveAdam: [.36, .55], light: [.5, .3, .16] },
  pecado: { all: [.5, .5], mobAll: [.5, .45], serpent: [.5, .2], serpent2: [.52, .45], fruit: [.36, .26], fruit2: [.345, .25],
    adam: [.28, .25], angel: [.66, .2], sword: [.758, .066, .835, .082], exile: [.84, .5], light: [.343, .245, .035] }
};
const GAP = [(PTS.adao.tipA[0] + PTS.adao.tipG[0]) / 2, (PTS.adao.tipA[1] + PTS.adao.tipG[1]) / 2];
const TXT = {
  verbo: 'NO PRINCÍPIO ERA O VERBO · E O VERBO SE FEZ CARNE · DO PÓ DA TERRA, O HOMEM · O FÔLEGO DA VIDA · HAJA LUZ · ',
  arvore: 'DA ÁRVORE DO CONHECIMENTO DO BEM E DO MAL NÃO COMERÁS · NO DIA EM QUE DELA COMERES, CERTAMENTE MORRERÁS · ',
  serpente: 'SE ABRIRÃO OS VOSSOS OLHOS · E SEREIS COMO DEUS · '
};
const GW = 48, GH = 86;                  // célula do atlas de letras (px)
const CELL_RATIO = GH / GW;               // altura / largura de cada célula na tela
const EW = .96, RP_FINAL = .17;           // meia largura do olho; raio da pupila ao fim do mergulho

const root = document.documentElement;
root.lang = root.lang || 'pt-BR';
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = mqReduce.matches;
const params = new URLSearchParams(location.search);
const capture = params.has('capture');
let fixedT = params.has('t') ? parseFloat(params.get('t')) : null;
const fixedClock = params.has('c') ? parseFloat(params.get('c')) : null;
let paused = false;

if (HAS_LUZ) { const l = document.querySelector('[data-list]'); if (l) l.textContent = 'A Separação da Luz e das Trevas, A Criação de Adão, A Criação de Eva e O Pecado Original e a Expulsão do Paraíso'; }

const canvas = document.getElementById('stage');
const backdrop = document.querySelector('.backdrop');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });

function fallback() {
  root.classList.add('no-gl');
  backdrop.style.backgroundImage = `url(${FRESCO.adao.src})`;
}
if (!gl) { fallback(); initText(); return; }

/* ---------- utilidades ---------- */
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const clamp01 = x => clamp(x, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const inOutCubic = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const outCubic = t => 1 - Math.pow(1 - t, 3);
const bump = (x, c, w) => Math.exp(-((x - c) / w) * ((x - c) / w));
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- shaders ---------- */
const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.-1., 0., 1.); }`;

const NOISE = `
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int k=0;k<4;k++){ s+=a*vn(p); p=p*2.07+vec2(5.3,1.7); a*=.5; } return s; }`;

// Passo 1: desenha a cena numa textura do tamanho da grade (média de 4 amostras por célula).
// O canal alfa leva um código por célula: 128 = afresco (pode virar palavras), 156 = corpo da serpente.
const FS_SCENE = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uGrid, uCellPx, uOffsetPx, uView;
uniform float uTime, uAspect, uMode;
uniform vec2 uCamC; uniform float uZoom;
uniform vec2 uIris; uniform float uLook, uPupil, uOpen, uCatch;
uniform float uContentShow, uContentFull, uContentZf, uLodAdd;
uniform sampler2D uTexA, uTexB, uMaskA;
uniform vec2 uSizeA, uSizeB;
uniform vec4 uCamA, uCamB;
uniform float uLodA, uLodB, uMix, uMaskOn, uWither;
uniform float uSpark, uTouch; uniform vec4 uSparkAB;
uniform float uFire; uniform vec4 uSword;
uniform vec4 uLight; uniform vec2 uLightK; uniform vec3 uLightCol;
uniform vec2 uSnakeK;
vec2 gEdge = vec2(.05);
uniform vec3 uFlash; uniform vec2 uFlashC;
${NOISE}
const float F_WORD = 128./255., F_SNAKE = 156./255.;
const float EW = ${EW.toFixed(3)};

/* ---- os afrescos ---- */
vec3 fetchF(sampler2D t, vec2 uv, float lod){
  vec2 e = smoothstep(vec2(0.), gEdge, uv)*smoothstep(vec2(1.), 1. - gEdge, uv);
  return textureLod(t, clamp(uv, 0., 1.), lod).rgb*e.x*e.y;
}
vec2 touchWarp(vec2 P){
  // os dois dedos andam até o meio do intervalo; a deformação é invertida por ponto fixo
  vec2 A = uSparkAB.xy, G = uSparkAB.zw, M = (A + G)*.5;
  vec2 cA = A + vec2(-4., .5), cG = G + vec2(4., -.5);
  vec2 dA = (M - A)*uTouch, dG = (M - G)*uTouch;
  vec2 Q = P;
  for(int i = 0; i < 5; i++){
    float wA = exp(-dot(Q - cA, Q - cA)/450.), wG = exp(-dot(Q - cG, Q - cG)/450.);
    Q = P - dA*wA - dG*wG;
  }
  return Q;
}
vec3 spark(vec3 c, vec2 P){
  vec2 A = uSparkAB.xy, G = uSparkAB.zw, M = (A + G)*.5;
  vec2 A2 = mix(A, M, uTouch*.96), G2 = mix(G, M, uTouch*.96);
  vec2 ab = G2 - A2;
  float t = clamp(dot(P - A2, ab)/max(dot(ab, ab), 1.), 0., 1.);
  vec2 n = normalize(vec2(-ab.y, ab.x) + vec2(0., 1e-4));
  float wob = sin(t*3.14159)*(vn(vec2(t*5., uTime*9.)) - .5)*8.*(1. - .8*uTouch);
  float dA = length(P - (A2 + ab*t + n*wob));
  float arc = exp(-dA*dA/(2.*1.3*1.3));
  float rM = length(P - M);
  float gapL = length(ab);                            // a faísca encurta junto com o intervalo
  float halo = exp(-rM*rM/(2.*(16. + gapL*gapL*.03))), halo2 = exp(-rM*rM/(2.*900.));
  float fl = .82 + .18*vn(vec2(uTime*7., 1.3));
  c *= 1. - .28*uSpark*(1. - halo2);
  return c + uSpark*fl*(vec3(1., .93, .7)*arc*1.2 + vec3(1., .8, .42)*halo*.4 + vec3(.95, .66, .28)*halo2*.18);
}
vec3 fireCol(float f){
  f = max(f, 0.);
  vec3 c = vec3(.6, .06, .02)*smoothstep(.08, .4, f);
  c = mix(c, vec3(1., .45, .06), smoothstep(.35, .75, f));
  c = mix(c, vec3(1., .84, .38), smoothstep(.7, 1.05, f));
  return mix(c, vec3(1., .9, .55), smoothstep(1.05, 1.5, f));
}
vec3 fireOn(vec3 c, vec2 P){
  // a espada inflamada: chamas que sobem da lâmina (na imagem, para cima é y menor)
  vec2 A = uSword.xy, ab = uSword.zw - A;
  float L = max(length(ab), 1.);
  float tr = dot(P - A, ab)/(L*L), h = clamp(tr, 0., 1.);
  vec2 d = P - (A + ab*h);
  float sc = L*.2;
  float up = -d.y/sc, dist = length(d)/sc, over = (tr - h)*L/sc;
  vec2 q = vec2(h*L/sc*1.7, up*.55 - uTime*2.2);
  float n = fbm(q + vec2(.7*fbm(q*.6 + vec2(0., uTime*.35)), 0.));
  float hgt = (1.6 + 2.8*n)*smoothstep(0., .1, h);
  float tongue = smoothstep(-.35, .25, up)*(1. - smoothstep(hgt*.1, max(hgt, 1e-3), up))*(.45 + .85*n)*exp(-over*over*1.5);
  float core = exp(-dist*dist*2.5);
  vec2 eq = vec2(h*L/sc*1.4, up*.9 - uTime*3.1);
  vec2 ei = floor(eq), ef = fract(eq) - .5;
  float eh = h12(ei + 17.);
  float ember = eh > .9 ? (1. - smoothstep(.05, .25, length(ef - vec2((eh - .95)*6., 0.))))*(1. - smoothstep(1., 5.5, up))*step(0., up)*exp(-over*over*.5) : 0.;
  float f = (core*1.4 + tongue*1.35 + ember*.9)*uFire;
  c *= 1. - .35*uFire*smoothstep(0., .4, f);
  c += vec3(.9, .42, .12)*exp(-dist*dist*.06)*.3*uFire;
  c += fireCol(f);
  return mix(c, vec3(1., .82, .4), exp(-dist*dist*30.)*uFire);
}
vec4 painting(vec2 s, float lodAdd){
  vec2 uv = uCamA.xy + (s - .5)*uCamA.zw;
  vec2 P = uv*uSizeA;
  if(uTouch > 0.) uv = touchWarp(P)/uSizeA;
  gEdge = vec2(.05, mix(.05, .13, smoothstep(1.02, 1.2, uCamA.w)));
  vec3 c = fetchF(uTexA, uv, uLodA + lodAdd);
  float flag = F_WORD;
  if(uLight.w > 0.){
    // um foco de luz dourada sobre o afresco (Haja luz, Eva, o fruto)
    vec2 dl = (P - uLight.xy)/uLight.z;
    float g = exp(-dot(dl, dl)*.5);
    c *= 1. - uLightK.x*uLight.w*(1. - g);
    c = mix(c, c*.5 + uLightCol*(.9 + .1*sin(uTime*2.3)), g*g*uLight.w*uLightK.y);
  }
  if(uSpark > 0.) c = spark(c, P);
  if(uFire > 0.) c = fireOn(c, P);
  if(uMaskOn > .5 && textureLod(uMaskA, clamp(uv, 0., 1.), 0.).r > .5){
    flag = F_SNAKE;
    if(uSnakeK.x > 0.){
      // as voltas da serpente: as linhas escuras entre elas viram buracos pretos (o menor brilho em volta da célula)
      const vec3 LW = vec3(.2126, .7152, .0722);
      vec2 cu = uCellPx/uView*uCamA.zw*.55;
      float mn = dot(c, LW);
      mn = min(mn, dot(fetchF(uTexA, uv + vec2(cu.x, 0.), uLodA), LW));
      mn = min(mn, dot(fetchF(uTexA, uv - vec2(cu.x, 0.), uLodA), LW));
      mn = min(mn, dot(fetchF(uTexA, uv + vec2(0., cu.y), uLodA), LW));
      mn = min(mn, dot(fetchF(uTexA, uv - vec2(0., cu.y), uLodA), LW));
      c *= 1. - uSnakeK.x*(1. - smoothstep(uSnakeK.y*.7, uSnakeK.y, mn));
    }
  }
  if(uMix > 0.){ gEdge = vec2(.05, mix(.05, .13, smoothstep(1.02, 1.2, uCamB.w))); c = mix(c, fetchF(uTexB, uCamB.xy + (s - .5)*uCamB.zw, uLodB + lodAdd), uMix); }
  if(uWither > 0.){ float l = dot(c, vec3(.2126, .7152, .0722)); c = mix(c, vec3(l)*vec3(1.08, .9, .78)*.8, uWither*.85); }
  return vec4(c, flag);
}

/* ---- O olho: só o olho, sobre o preto ---- */
float tiltY(float t){ return mix(.035, -.02, t*.5 + .5); }
float lidUpY(float x){ float t = clamp(x/EW, -1., 1.); float t2 = t - .12*(1. - t*t); return .43*pow(max(1. - t2*t2, 0.), .7) + tiltY(t); }
float lidLoY(float x){ float t = clamp(x/EW, -1., 1.); float t3 = t + .1*(1. - t*t); return -.31*pow(max(1. - t3*t3, 0.), .9) + tiltY(t); }
float vfield(vec2 p, vec2 C, float side, vec2 k, float seed){
  vec2 d = vec2((C.x - p.x)*side, p.y - C.y);
  float r = length(d), a = atan(d.y, max(d.x, 1e-4));
  vec2 w = vec2(r*k.x, a*k.y);
  w += (vec2(vn(w*1.9 + seed), vn(w*1.9 + seed + 7.3)) - .5)*1.1;
  return vn(w + seed*3.1);
}
// veias: a linha de nível 0.5 de um ruído esticado em volta do canto, com largura constante
float vein(vec2 p, vec2 C, float side, vec2 k, float seed, float width){
  const float e = .0025;
  float f = vfield(p, C, side, k, seed);
  float fx = vfield(p + vec2(e, 0.), C, side, k, seed);
  float fy = vfield(p + vec2(0., e), C, side, k, seed);
  float g = length(vec2(fx - f, fy - f))/e;
  return 1. - smoothstep(width*.5, width*.5 + .005, abs(f - .5)/max(g, 1.));
}
vec3 sclera(vec2 p){
  float t = p.x/EW;
  vec3 c = vec3(.94, .92, .89);
  c *= 1. - .3*pow(abs(t), 2.4);
  c = mix(c, vec3(.93, .7, .66), smoothstep(.55, .98, t)*.35 + smoothstep(-.6, -.98, t)*.25);
  vec2 Ci = vec2(EW, tiltY(1.)), Co = vec2(-EW, tiltY(-1.));
  float ri = length(p - Ci), ro = length(p - Co), v = 0.;
  if(ri < .95) v = max(v, vein(p, Ci, 1., vec2(2.4, 3.3), 1.7, .013)*smoothstep(.95, .2, ri));
  if(ri < .6) v = max(v, vein(p, Ci, 1., vec2(5., 7.), 4.2, .007)*smoothstep(.6, .12, ri)*.8);
  if(ro < .85) v = max(v, vein(p, Co, -1., vec2(2.4, 3.3), 8.1, .012)*smoothstep(.85, .2, ro));
  if(ro < .55) v = max(v, vein(p, Co, -1., vec2(5., 7.), 2.9, .007)*smoothstep(.55, .12, ro)*.7);
  c = mix(c, vec3(.66, .03, .04), v);
  vec2 cq = (p - Ci - vec2(-.075, 0.))/vec2(.075, .055);
  c = mix(c, vec3(.86, .42, .42)*(.85 + .3*vn(p*60.)), smoothstep(1., .55, length(cq)));
  return c*(.97 + .05*vn(p*vec2(30., 40.)));
}
vec3 irisCol(vec2 q, float R){
  float r = length(q)/R, a = atan(q.y, q.x);
  vec2 ang = vec2(cos(a), sin(a));
  float f1 = vn(ang*14. + r*2.2), f2 = vn(ang*42. + vec2(r*7., r*3.)), f3 = vn(ang*110. + r*2.);
  float fib = .45*f1 + .35*f2 + .2*f3;
  float coll = .5 + .045*sin(a*11. + f1*3.) + .02*(f2 - .5);
  vec3 c = mix(vec3(.8, .55, .12), vec3(.98, .8, .26), smoothstep(.22, .42, r));
  c = mix(c, vec3(.14, .74, .52), smoothstep(coll - .02, coll + .07, r));
  c = mix(c, vec3(.07, .58, .52), smoothstep(.66, .88, r + (fib - .5)*.2));
  c *= .8 + .5*fib;
  float zc = (r - coll)/.03;
  c += vec3(.12, .1, .03)*exp(-zc*zc);
  float cr = smoothstep(.6, .78, vn(ang*8. + r*6. + 13.));
  c *= 1. - .4*cr*smoothstep(.5, .62, r)*smoothstep(.9, .78, r);
  float z1 = (r - .78)/.018, z2 = (r - .88)/.015;
  c *= 1. - .18*exp(-z1*z1) - .14*exp(-z2*z2);
  c *= 1. + .3*smoothstep(.2, .9, -q.y/R)*smoothstep(.25, .8, r);   // luz que atravessa a córnea
  return mix(c*1.15, vec3(.03, .22, .2), smoothstep(.9, 1., r));
}
vec4 pupilContent(vec2 p){
  // o ponto do olho vira o ponto da tela que ele vai ocupar quando a câmera chegar ao zoom final
  vec2 n = (p - uIris)*uContentZf;
  return painting(vec2(.5 + n.x/(2.*uAspect), .5 - n.y*.5), uLodAdd);
}
vec4 eye(vec2 p){
  float yU = lidUpY(p.x), yL = lidLoY(p.x), yC = mix(yL, yU, .2);
  float yu = mix(yC, yU, uOpen), yl = mix(yC, yL, smoothstep(0., .5, uOpen));
  float ax = abs(p.x);
  if(ax >= EW || p.y <= yl || p.y >= yu) return vec4(0.);
  vec3 b = sclera(p);
  float flag = 0.;
  const float R = .345;
  vec2 q = p - uIris;
  q.x /= mix(1., .82, abs(uLook));
  float d = length(q);
  if(d < R + .03){
    b = mix(b, irisCol(q, R), smoothstep(R + .012, R - .012, d));
    b = mix(b, vec3(.16, .08, .03), smoothstep(uPupil + .013, uPupil + .004, d)*.55);
    float pe = smoothstep(uPupil + .008, uPupil - .004, d);
    vec3 inner = vec3(.008, .007, .009);
    if(uContentShow > 0.){
      vec4 cc = pupilContent(p);
      float aC = uContentShow*mix(smoothstep(1., .3, d/uPupil), 1., uContentFull);
      inner = mix(inner, cc.rgb, aC);
      flag = cc.a*step(.5, pe)*step(.001, aC);
    }
    b = mix(b, inner, pe);
  }
  // reflexos na córnea: andam menos que a íris, porque a luz está parada
  float corn = smoothstep(R + .02, R - .02, length(p - uIris));
  vec2 hq = (p - uIris*.65 - vec2(-.12, .135))/vec2(.06, .045);
  float win = smoothstep(1., .7, max(abs(hq.x + hq.y*.15), abs(hq.y)));
  float dot2 = smoothstep(.022, .01, length(p - uIris*.65 - vec2(.13, -.1)));
  b = mix(b, vec3(1.), (win*.9 + dot2*.6)*uCatch*corn);
  // sombra da pálpebra de cima, menisco da lágrima, cílios sobre a borda
  float dt = yu - p.y, db = p.y - yl;
  b *= mix(.55, 1., smoothstep(0., .085, dt));
  b *= mix(.78, 1., smoothstep(0., .04, db));
  float zm = (db - .012)/.006;
  b += vec3(.18, .14, .13)*exp(-zm*zm)*smoothstep(EW, EW*.6, ax);
  b *= 1. - .6*smoothstep(.5, .9, vn(vec2(p.x*90., 2.7)))*smoothstep(.035, 0., dt);
  float aa = smoothstep(0., .008, min(dt, db));
  return vec4(b*aa, flag*step(.5, aa));
}

vec4 sceneAt(vec2 s){
  if(uMode < .5) return eye(uCamC + vec2((s.x - .5)*2.*uAspect, (.5 - s.y)*2.)/uZoom);
  return painting(s, 0.);
}
vec3 flash(vec3 c, vec2 s){
  float d = length((s - uFlashC)*vec2(uAspect, 1.));
  float k = uFlash.x;
  if(uFlash.y > 0.) k = max(k, smoothstep(uFlash.y, uFlash.y*.55, d));
  if(k <= 0.) return c;
  // a luz nasce dos dedos: núcleo branco, anéis dourados e bordas âmbar; a tela inteira acende, em degraus de letras
  float cw = max(uFlash.z, .05);
  float core = exp(-d*d/(cw*cw));
  vec3 lc = mix(vec3(.95, .66, .30)*mix(.42, .8, exp(-d*1.8)), vec3(1., .97, .9), core);
  return mix(c, lc, k);
}
void main(){
  vec2 cell = floor(gl_FragCoord.xy);
  float rowTop = uGrid.y - 1. - cell.y;
  vec3 acc = vec3(0.);
  float flag = 0.;
  for(int k = 0; k < 4; k++){
    vec2 o2 = vec2((k == 0 || k == 2) ? .3 : .7, k < 2 ? .3 : .7);
    vec2 s = (uOffsetPx + (vec2(cell.x, rowTop) + o2)*uCellPx)/uView;
    vec4 c = sceneAt(s);
    acc += flash(c.rgb, s);
    if(k == 0) flag = c.a;
  }
  o = vec4(acc*.25, flag);
}`;

// Passo 2: troca cada célula por uma letra do atlas, pintada com a cor da célula
const FS_ASCII = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uScene, uAtlas, uText;
uniform vec2 uGrid, uCellPx, uOffsetPx, uView, uAtlasGrid, uWave, uTxtWords, uTxtSnake;
uniform vec3 uStars;
uniform float uRampN, uTextBase, uTime, uFlicker, uWords, uDecode, uFade, uGlowLod, uFall, uStarAmt, uSnakeAmt;
uniform vec4 uToneE, uToneF, uBurst, uSpot; uniform vec3 uSpotCol;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float textGlyph(float pos, vec2 txt){
  float ti = texelFetch(uText, ivec2(int(txt.x + mod(pos, txt.y)), 0), 0).r*255.;
  return uTextBase + floor(ti + .5);
}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y) - uOffsetPx;
  vec2 cf = fc/uCellPx;
  vec2 cell = floor(cf);
  vec2 f = cf - cell;
  vec3 bg = vec3(0.);
  if(cell.x < 0. || cell.y < 0. || cell.x >= uGrid.x || cell.y >= uGrid.y){ o = vec4(bg, 1.); return; }
  // a queda: as colunas de letras despencam, uma depois da outra
  vec2 src = cell;
  float fk = 0.;
  if(uFall > 0.){
    float dl = h12(vec2(cell.x*1.31, 4.7))*.42 + .12*(.5 + .5*sin(cell.x*.13));
    float u = max(0., uFall*1.6 - dl);
    float off = u*u*1.35*uGrid.y;
    src.y = cell.y - floor(off);
    fk = clamp(off*.25, 0., 1.);
    if(src.y < 0.){ o = vec4(bg, 1.); return; }
  }
  vec4 sc = texelFetch(uScene, ivec2(int(src.x), int(uGrid.y - 1. - src.y)), 0);
  vec3 c = sc.rgb;
  float A = floor(sc.a*255. + .5);
  float lum = dot(c, vec3(.2126, .7152, .0722));
  float jit = (h12(cell*1.37 + floor(uTime*8.)) - .5)*uFlicker;
  bool fz = A > 100.;                       // célula de afresco (também dentro da pupila)
  vec4 tn = fz ? uToneF : uToneE;           // curva (expoente, ganho) e cor (normalização, brilho)
  float lp = pow(lum, tn.x);
  float L = clamp(tn.y*lp/(1. + (tn.y - 1.)*lp) + jit, 0., 1.);   // ombro suave: os claros se espalham pelas últimas letras
  if(fz) L = max(0., (L - .06)/.94);         // ponto de preto: o fundo dos afrescos some no preto
  float gi = floor(L*(uRampN - .001));
  if(uBurst.z > .5 && L > .97) gi = uRampN - 1. - floor(h12(cell + floor(uTime*12.))*5.);   // o núcleo do clarão faísca
  bool word = false, snake = false;
  float pos = src.y*uGrid.x + src.x;
  if(uWords > .5 && A > 100. && A < 160.){
    float th = clamp(length((cell - uWave)*vec2(1., 1.79))/(uGrid.x*1.05), 0., 1.)*.8 + h12(cell + 3.1)*.2;
    float st = uDecode - th;
    if(st < 0.){ gi = textGlyph(pos, uTxtWords); word = true; }
    else if(st < .07){ gi = floor(h12(cell + floor(uTime*24.))*(uRampN - .001)); }
  }
  // o corpo da serpente é escrito com as palavras dela
  if(A > 155.5 && lum > .02 && h12(src*.91 + 5.3) < uSnakeAmt){ gi = textGlyph(pos + floor(uTime*3.5), uTxtSnake); word = true; snake = true; }
  if(fk > 0.){
    if(h12(cell + floor(uTime*16.)) < .3*fk) gi = floor(h12(cell*2.3 + floor(uTime*16.))*(uRampN - .001));
    c = mix(c, vec3(lum)*vec3(1.25, .72, .55), .55*fk);
  }
  // estrelas: pontos raros no fundo escuro, como no vídeo
  float star = 0.;
  if(!word && A > 40. && A < 155.5 && lum < .2 && uStarAmt > 0.){
    float hs = h12(cell*.73 + 11.);
    if(hs > .986){ star = (.55 + .45*sin(uTime*1.7 + hs*90.))*uStarAmt; float k = fract(hs*37.); gi = k < .5 ? uStars.x : (k < .8 ? uStars.y : uStars.z); }
  }
  vec2 g = vec2(mod(gi, uAtlasGrid.x), floor(gi/uAtlasGrid.x));
  float gs = word ? .86 : 1.;
  vec2 fl = clamp((f - .5)*gs + .5, 0., 1.);
  vec2 auv = (g + fl)/uAtlasGrid;
  vec2 dx = vec2(gs/(uCellPx.x*uAtlasGrid.x), 0.), dy = vec2(0., gs/(uCellPx.y*uAtlasGrid.y));
  float m = textureGrad(uAtlas, auv, dx, dy).r;
  float b = textureLod(uAtlas, auv, uGlowLod).r;
  vec3 col;
  if(word){ col = snake ? min(pow(c, vec3(1.3))*2.1, vec3(1.15)) : min(pow(c, vec3(.8))*1.55, vec3(1.15)); }
  else { float mx = max(max(c.r, c.g), max(c.b, 1e-3)); col = mix(c, c/mx*.95, tn.z*smoothstep(.06, .4, lum));
    col = mix(col, min(pow(c, vec3(.8))*1.55, vec3(1.15)), uBurst.z*smoothstep(.5, .9, lum)); }
  if(star > 0.) col = vec3(.95, .88, .7)*star;
  vec3 outc = col*(m + tn.w*b);
  if(uBurst.z > 0.){
    float rb = length(gl_FragCoord.xy - uBurst.xy)/uView.y;
    float cb = uBurst.z*exp(-rb*rb/(2.*uBurst.w*uBurst.w));
    outc = outc*(1. + 1.2*cb) + vec3(1., .93, .78)*cb*(.22 + .7*b);
  }
  if(uSpot.z > 0.){
    float rs = length(gl_FragCoord.xy - uSpot.xy)/uView.y;
    float cs = uSpot.z*exp(-rs*rs/(2.*uSpot.w*uSpot.w));
    outc = outc*(1. + .9*cs) + uSpotCol*cs*(.12 + .6*b);
  }
  vec2 sv = gl_FragCoord.xy/uView - .5;
  outc *= 1. - .45*(1. - uBurst.z)*pow(clamp(length(sv)*1.25, 0., 1.), 2.6);
  o = vec4(bg + outc*uFade, 1.);
}`;

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
function set(P, name, ...v) {
  const loc = P.u[name]; if (loc == null) return;
  if (v.length === 1) gl.uniform1f(loc, v[0]); else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
  else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]); else gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
}
function tex(filter) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

let P1, P2, vao, blankTex;
function initPrograms() {
  P1 = program(FS_SCENE); P2 = program(FS_ASCII);
  vao = gl.createVertexArray();
  blankTex = tex(gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
}
try { initPrograms(); }
catch (err) { console.error(err); fallback(); initText(); return; }

/* ---------- texturas: um afresco por textura, com mipmaps; a máscara da serpente à parte ---------- */
const ftex = {}, fimg = {};
let maskTex = null, maskImg = null;
function upload(t, im, mips) {
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
  if (mips) gl.generateMipmap(gl.TEXTURE_2D);
}
// cria as texturas dos afrescos (de novo, se o contexto voltar) com as imagens já decodificadas
function makeFrescoTextures() {
  for (const id of Object.keys(FRESCO)) {
    const t = ftex[id] = tex(gl.LINEAR_MIPMAP_LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.generateMipmap(gl.TEXTURE_2D);
    if (fimg[id]) upload(t, fimg[id], true);
  }
  maskTex = null;
  if (maskImg) { maskTex = tex(gl.LINEAR); upload(maskTex, maskImg, false); }
}
makeFrescoTextures();
function loadImage(src, onload) {
  return new Promise(resolve => {
    if (!src) { resolve(); return; }
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { onload(im); resolve(); };
    im.onerror = () => resolve();
    im.src = src;
  });
}
const imgReady = Promise.all(Object.entries(FRESCO).map(([id, F]) => Promise.all([
  loadImage(F.src, im => { fimg[id] = im; if (!lost) upload(ftex[id], im, true); }),
  id === 'pecado' && F.mask ? loadImage(F.mask, im => { maskImg = im; if (!lost) { maskTex = tex(gl.LINEAR); upload(maskTex, im, false); } }) : null
])));

let atlasTex = null, textTex = null;
const atlas = { cols: 16, rows: 1, rampN: 1, textBase: 0, txt: { verbo: [0, 1], arvore: [0, 1], serpente: [0, 1] }, ramp: '', stars: [0, 0, 0] };

function buildAtlas() {
  const font = `600 64px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const m = document.createElement('canvas'); m.width = GW; m.height = GH;
  const mx = m.getContext('2d', { willReadFrequently: true });
  mx.font = font; mx.textAlign = 'center'; mx.textBaseline = 'middle';
  const cand = [' ']; for (let c = 33; c < 127; c++) cand.push(String.fromCharCode(c));
  const cov = new Map();
  for (const ch of cand) {
    mx.fillStyle = '#000'; mx.fillRect(0, 0, GW, GH); mx.fillStyle = '#fff'; mx.fillText(ch, GW / 2, GH / 2 + 2);
    const d = mx.getImageData(0, 0, GW, GH).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
    cov.set(ch, s);
  }
  const max = Math.max(...cov.values()) || 1;
  const items = cand.map(ch => ({ ch, v: cov.get(ch) / max }));
  const N = 56, used = new Set(), ramp = [];
  for (let k = 0; k < N; k++) {
    const target = k / (N - 1); let best = null, bd = 1e9;
    for (const it of items) { if (used.has(it.ch)) continue; const d = Math.abs(it.v - target); if (d < bd) { bd = d; best = it; } }
    used.add(best.ch); ramp.push(best);
  }
  ramp.sort((a, b) => a.v - b.v);
  const rampChars = ramp.map(r => r.ch);
  const names = Object.keys(TXT);
  const allText = names.map(k => TXT[k]).join('');
  const textChars = [...new Set([...allText])];
  const total = rampChars.length + textChars.length;
  const cols = 16, rows = Math.ceil(total / cols);
  const c = document.createElement('canvas'); c.width = cols * GW; c.height = rows * GH;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#fff'; x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  rampChars.forEach((ch, i) => x.fillText(ch, (i % cols) * GW + GW / 2, Math.floor(i / cols) * GH + GH / 2 + 2));
  x.font = font.replace('600 64px', '800 66px');
  textChars.forEach((ch, j) => { const i = rampChars.length + j; x.fillText(ch, (i % cols) * GW + GW / 2, Math.floor(i / cols) * GH + GH / 2 + 2); });
  if (atlasTex) gl.deleteTexture(atlasTex);
  if (textTex) gl.deleteTexture(textTex);
  atlasTex = tex(gl.LINEAR_MIPMAP_LINEAR);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  const idx = new Uint8Array([...allText].map(ch => textChars.indexOf(ch)));
  textTex = tex(gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, idx.length, 1, 0, gl.RED, gl.UNSIGNED_BYTE, idx);
  const txt = {}; let off = 0;
  for (const k of names) { const n = [...TXT[k]].length; txt[k] = [off, n]; off += n; }
  const si = ch => { const i = rampChars.indexOf(ch); return i < 0 ? Math.floor(rampChars.length * .35) : i; };
  Object.assign(atlas, { cols, rows, rampN: rampChars.length, textBase: rampChars.length, txt,
    ramp: rampChars.join(''), stars: [si('.'), si('+'), si('*')] });
  const rampEl = document.querySelector('[data-ramp]'); if (rampEl) rampEl.textContent = atlas.ramp.trim();
  const nEl = document.querySelector('[data-rampn]'); if (nEl) nEl.textContent = String(atlas.rampN);
}

/* ---------- grade e tamanho ---------- */
const view = { w: 1, h: 1, dpr: 1, aspect: 1, cw: 9, cwd: 18, chd: 32, cols: 1, rows: 1, ox: 0, oy: 0 };
const dprCap = matchMedia('(pointer: coarse)').matches ? 1.5 : 2;
let qualityCap = 2;
let cellCss = innerWidth >= 1000 ? 9 : innerWidth >= 600 ? 8 : 6;
let sceneTex = null, fbo = null;
const probe = document.createElement('div');
probe.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:100svh;visibility:hidden;pointer-events:none';
document.body.appendChild(probe);
let unit = innerHeight;
const secT = { olho: 0, pupila: 1, verbo: 3.4, criacao: 5, toque: 7.2, eva: 10.2, eden: 12.8, fruto: 15.8, espada: 18, queda: 20.6, fim: 22.6 };
const sections = [...document.querySelectorAll('main > section')];
const caps = [...document.querySelectorAll('.cap')];
let plan = null, stops = [0], maxT = 26;
const hero = { top: 1, bar: .05 };   // topo do texto de abertura e altura da barra, em frações da tela

function measure() {
  unit = probe.getBoundingClientRect().height || innerHeight;
  for (const s of sections) secT[s.id] = (s.getBoundingClientRect().top + scrollY) / unit;
  maxT = Math.max(1, (root.scrollHeight - root.clientHeight) / unit);
  // movimento reduzido: uma parada por legenda, com a legenda no meio da tela
  stops = [0, ...caps.map(c => { const r = c.getBoundingClientRect(); return (r.top + scrollY + r.height / 2) / unit - .5; }), maxT].sort((a, b) => a - b);
  // a legenda do toque cai sobre o clarão: no movimento reduzido, a parada mostra os dedos se tocando
  stops = stops.map(v => v >= secT.toque + 1.96 && v <= secT.toque + 2.6 ? secT.toque + 1.95 : v);
  const fc = document.querySelector('#fim .cap');
  if (fc && innerWidth < innerHeight) {
    const r = fc.getBoundingClientRect(), mid = (r.top + scrollY + r.height / 2) / unit - .5;
    stops = stops.map(v => Math.abs(v - mid) < 1e-6 ? (r.top + scrollY) / unit - .43 : v).sort((a, b) => a - b);
  }
  const hc = document.querySelector('.hero-copy'), bt = document.querySelector('.bar-top .win');
  const vh = innerHeight || 1;
  if (hc) hero.top = (hc.getBoundingClientRect().top + scrollY) / vh;
  if (bt) hero.bar = (bt.getBoundingClientRect().bottom + 8) / vh;
  plan = null;
  buildFilm();
}
function resize() {
  const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap, qualityCap);
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const cwd = Math.max(3, Math.round(cellCss * dpr)), chd = Math.round(cwd * CELL_RATIO);
  const cols = Math.ceil(canvas.width / cwd), rows = Math.ceil(canvas.height / chd);
  Object.assign(view, { w: canvas.width, h: canvas.height, dpr, aspect: w / h, cwd, chd, cols, rows,
    ox: (canvas.width - cols * cwd) / 2, oy: (canvas.height - rows * chd) / 2 });
  if (sceneTex) gl.deleteTexture(sceneTex);
  sceneTex = tex(gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  film.lastY = null;
  if (!fbo) fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  measure();
  const g = document.querySelector('[data-grid]'); if (g) g.textContent = `${cols} × ${rows}`;
}
let resizeQueued = false;
function queueResize() { if (resizeQueued) return; resizeQueued = true; requestAnimationFrame(() => { resizeQueued = false; resize(); }); }
addEventListener('resize', queueResize);
{ // o zoom do navegador ou outra tela mudam a densidade de pixels sem sempre disparar 'resize'
  const watch = () => matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener?.('change', () => { queueResize(); watch(); }, { once: true });
  watch();
}
if ('ResizeObserver' in window) new ResizeObserver(queueResize).observe(document.body);

/* ---------- o olho: abre, olha à esquerda, à direita, ao centro (funções puras do relógio) ---------- */
function openIntro(t) {
  // abre em dois tempos: entreabre, hesita, abre de vez
  return .55 * outCubic(clamp01((t - .45) / .55)) + .45 * inOutCubic(clamp01((t - 1.15) / .75));
}
const SACC = [[0, 0, 0], [2.35, -.9, .03], [3.55, .9, .03], [4.75, 0, 0]];
{
  const r = mulberry32(2026); let t = 6.8;
  while (t < 1800) { const x = r() < .3 ? 0 : (r() < .5 ? -1 : 1) * (.45 + r() * .5); SACC.push([t, x, (r() - .5) * .16]); t += 1.4 + r() * 2.6; }
}
const saccEase = u => { u = clamp01(u); return u * u * u * (u * (u * 6 - 15) + 10); };
function gazeAt(t) {
  let lo = 0, hi = SACC.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (SACC[m][0] <= t) lo = m; else hi = m - 1; }
  const cur = SACC[lo], prev = SACC[Math.max(0, lo - 1)];
  const k = lo === 0 ? 1 : saccEase((t - cur[0]) / .12);
  return [lerp(prev[1], cur[1], k), lerp(prev[2], cur[2], k)];
}
function pupilAt(t) { return .088 + .005 * Math.sin(t * .7) + .003 * Math.sin(t * 1.9 + 1.3) + .028 * (1 - smooth(.6, 2.6, t)); }

// cursor: depois da apresentação, a íris acompanha o mouse
const pointer = { x: .5, y: .5, t: -99 };
const pf = { x: 0, y: 0, w: 0 };
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
addEventListener('pointermove', e => {
  if (!finePointer.matches) return;
  pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight; pointer.t = clock;
}, { passive: true });
function updatePointer(dt) {
  const active = !reduced && !paused && !film.on && finePointer.matches && clock > 6.8 && clock - pointer.t < 2.5;
  pf.w += ((active ? 1 : 0) - pf.w) * (1 - Math.exp(-dt * (active ? 5 : 1.2)));
  const tx = clamp((pointer.x - .5) * 2.4, -1, 1), ty = clamp(-(pointer.y - .5) * 1.6, -1, 1);
  pf.x += (tx - pf.x) * (1 - Math.exp(-dt * 12)); pf.y += (ty - pf.y) * (1 - Math.exp(-dt * 12));
}

/* ---------- câmeras nos afrescos (uv da imagem; zoom 1 = a imagem cobre a tela) ---------- */
function fview(id, z) {
  const F = FRESCO[id], A = F.w / F.h, a = view.aspect;
  const vh = Math.min(1, A / a) / z;
  return [vh * a / A, vh];
}
function fclamp(id, cx, cy, z, up = 0) {
  const [vw, vh] = fview(id, z);
  cx = vw >= 1 ? .5 : clamp(cx, vw / 2, 1 - vw / 2);
  cy = vh >= 1 ? .5 : clamp(cy, vh / 2 - up * vh, 1 - vh / 2);
  return [cx, cy, vw, vh];
}
function keyAt(K, Tv) {
  if (Tv <= K[0].t) return [K[0].cx, K[0].cy, K[0].z, K[0].up || 0];
  for (let i = 0; i < K.length - 1; i++) {
    const p = K[i], q = K[i + 1];
    if (Tv < q.t) { const e = smooth(p.t, q.t, Tv); return [lerp(p.cx, q.cx, e), lerp(p.cy, q.cy, e), Math.exp(lerp(Math.log(p.z), Math.log(q.z), e)), lerp(p.up || 0, q.up || 0, e)]; }
  }
  const l = K[K.length - 1]; return [l.cx, l.cy, l.z, l.up || 0];
}
function keyLin(K, Tv) {
  if (Tv <= K[0][0]) return K[0][1];
  for (let i = 0; i < K.length - 1; i++) if (Tv < K[i + 1][0]) return lerp(K[i][1], K[i + 1][1], (Tv - K[i][0]) / (K[i + 1][0] - K[i][0]));
  return K[K.length - 1][1];
}
const camOf = (id, Tv) => { const k = keyAt(plan.cams[id], Tv); return fclamp(id, k[0], k[1], k[2], k[3]); };
const toScreen = (cam, u, v) => [(u - cam[0]) / cam[2] + .5, (v - cam[1]) / cam[3] + .5];
const lodOf = (F, cam) => Math.max(0, Math.log2(cam[2] * F.w / view.cols / 2));

/* ---------- linha do tempo da rolagem (funções puras de T, em telas) ---------- */
function buildPlan() {
  const S = secT, a = view.aspect, mob = a < 1;
  const d1 = S.verbo - .3;                       // fim do mergulho na pupila
  const tTouch = S.toque + 2, tEva = S.toque + 2.3;
  // zoom que mostra o afresco inteiro (com faixas pretas se preciso)
  const zAll = id => { const F = FRESCO[id], A = F.w / F.h; return Math.min(A, a) / Math.max(A, a); };
  const K = (t, p, z, up = 0) => ({ t, cx: p[0], cy: p[1], z, up });
  const cams = {};
  const Ad = PTS.adao;
  cams.adao = [
    K(d1, Ad.all, 1), K(S.criacao + .05, Ad.all, 1),
    K(S.criacao + .55, Ad.adam, mob ? 1 : 1.55), K(S.criacao + .95, [Ad.adam[0] + .02, Ad.adam[1] - .01], mob ? 1.06 : 1.62),
    K(S.criacao + 1.4, Ad.god, mob ? 1 : 1.55), K(S.criacao + 1.8, [Ad.god[0] + .01, Ad.god[1] + .01], mob ? 1.06 : 1.62),
    K(S.toque + .05, Ad.all, 1), K(S.toque + .8, GAP, mob ? 2.5 : 3.1), K(S.toque + 1.9, GAP, mob ? 3.1 : 3.9)
  ];
  if (HAS_LUZ) {
    const L = PTS.luz;
    cams.luz = mob ? [K(d1, L.mobAll, 1), K(S.verbo + .8, L.god, 1.12)]
               : [K(d1, L.all, .64), K(S.verbo - .1, L.all, .72), K(S.verbo + .8, L.god, 1.12)];
  }
  // A Criação de Eva: Adão dorme; Eva sai do lado dele e se volta para Deus
  const E = PTS.eva, eAll = mob ? E.mobAll : E.all, ez = mob ? 1 : Math.max(.9, zAll('eva'));
  const Ez = mob ? { adam: 1.15, eveGod: 1.2, eveAdam: 1 } : { adam: 1.5, eveGod: 1.5, eveAdam: 1.2 };
  cams.eva = [
    K(tEva, eAll, ez), K(S.eva + .05, eAll, ez * 1.03),
    K(S.eva + .5, E.adam, Ez.adam), K(S.eva + .8, [E.adam[0] + .02, E.adam[1] - .01], Ez.adam * 1.06),
    K(S.eva + 1.25, E.eveGod, Ez.eveGod), K(S.eva + 1.55, [E.eveGod[0] - .01, E.eveGod[1]], Ez.eveGod * 1.06),
    K(S.eva + 1.95, E.eveAdam, Ez.eveAdam), K(S.eden + .12, E.eveAdam, Ez.eveAdam * 1.06)
  ];
  // O Pecado Original e a Expulsão: a árvore e a serpente, o fruto, Adão, o anjo e a espada, os dois expulsos
  const Pc = PTS.pecado, pAll = mob ? Pc.mobAll : Pc.all;
  const Pz = mob ? { all: .72, serp: 1, serp2: 1.2, fruit: 1.55, fruit2: 1.8, adam: 1.15, angel: 2, sword: 2.2, sword2: 2.5, exile: 1 }
                 : { all: zAll('pecado') * 1.03, serp: 1.6, serp2: 1.85, fruit: 2, fruit2: 2.25, adam: 1.7, angel: 1.9, sword: 2, sword2: 2.2, exile: 1.45 };
  const swc = [(Pc.sword[0] + Pc.sword[2]) / 2 + .01, (Pc.sword[1] + Pc.sword[3]) / 2 + .04];
  cams.pecado = [
    K(S.eden + .1, pAll, Pz.all), K(S.eden + 1.05, pAll, Pz.all * 1.04),
    K(S.eden + 1.85, Pc.serpent, Pz.serp), K(S.eden + 2.6, Pc.serpent2, Pz.serp2),
    K(S.fruto + .45, Pc.fruit, Pz.fruit), K(S.fruto + 1.25, Pc.fruit2, Pz.fruit2),
    K(S.fruto + 1.95, Pc.adam, Pz.adam),
    K(S.espada + .6, mob ? [.615, .15] : [.64, .15], Pz.angel, mob ? .3 : .25),
    K(S.espada + 1.35, swc, Pz.sword, mob ? .3 : .2), K(S.espada + 1.95, swc, Pz.sword2, mob ? .3 : .24),
    K(S.espada + 2.45, Pc.exile, Pz.exile),
    K(S.queda + .45, pAll, Pz.all)
  ];
  for (const id in cams) cams[id].sort((p, q) => p.t - q.t);   // se as alturas mudarem, as chaves não se invertem
  // focos de luz: [afresco] → ponto, raio e quando acendem e apagam
  const lights = {
    eva: { p: E.light, t0: S.eva + .85, t1: S.eva + 1.15, t2: S.eva + 1.7, t3: S.eva + 2.05, k: [.25, .6], col: [1, .86, .55], spot: [.3, .09] },
    pecado: { p: Pc.light, t0: S.fruto + .05, t1: S.fruto + .35, t2: S.fruto + 1.45, t3: S.fruto + 1.8, k: [.35, 1], col: [1, .55, .1], spot: [.8, .055] }
  };
  if (HAS_LUZ) lights.luz = { p: PTS.luz.light, t0: S.pupila + 1.3, t1: S.pupila + 1.6, t2: S.verbo - .2, t3: S.verbo + .3, k: [0, .9], col: [1, .9, .62] };
  // qual afresco está na tela, e as fusões entre eles (sempre escondidas sob as palavras)
  const seq = HAS_LUZ ? [[-1e9, 'luz'], [S.verbo + .6, 'adao'], [tEva, 'eva'], [S.eden + .32, 'pecado']]
                      : [[-1e9, 'adao'], [tEva, 'eva'], [S.eden + .32, 'pecado']];
  const fades = [[S.eden + .12, S.eden + .52, 'eva', 'pecado']];
  if (HAS_LUZ) fades.unshift([S.verbo + .4, S.verbo + .8, 'luz', 'adao']);
  // 0 = tudo em palavras, 1.1 = tudo em letras de densidade
  const eden = [[S.eden - .4, 1.1], [S.eden + .08, 0], [S.eden + .56, 0], [S.eden + 1.16, 1.1]];
  const decode = HAS_LUZ
    ? [[-1e9, 1.1], [S.verbo - .15, 1.1], [S.verbo + .35, 0], [S.verbo + .85, 0], [S.verbo + 1.45, 1.1], ...eden]
    : [[-1e9, 0], [S.verbo + .45, 0], [S.verbo + 1.05, 1.1], ...eden];
  // de onde parte a onda que troca palavras por letras: [desde, afresco, u, v]
  const wave = [[-1e9, 'adao', GAP[0], GAP[1]], [S.eden - .45, 'eva', E.eve[0], E.eve[1]], [S.eden + .3, 'pecado', Pc.fruit[0], Pc.fruit[1]]];
  if (HAS_LUZ) wave.unshift([-1e9, 'luz', PTS.luz.god[0], PTS.luz.god[1]]), wave[1][0] = S.verbo + .6;
  return { d1, tTouch, tEva, tText: S.eden - .45, cams, seq, fades, decode, wave, lights };
}
function frescoAt(Tv) {
  for (const [t0, t1, A, B] of plan.fades) if (Tv >= t0 && Tv < t1) return { A, B, mix: smooth(t0, t1, Tv) };
  let id = plan.seq[0][1];
  for (const [t, s] of plan.seq) if (Tv >= t) id = s;
  return { A: id, B: id, mix: 0 };
}
function waveAt(Tv) { let w = plan.wave[0]; for (const x of plan.wave) if (Tv >= x[0]) w = x; return w; }

function frameState(Tv, clk, live) {
  if (!plan) plan = buildPlan();
  const S = secT, a = view.aspect;
  const st = { T: Tv, clk };
  let base = Math.min(clamp(a / 1.25, .4, 1.45), a / (EW * 1.08));
  let heroY0 = a >= 1 ? -.2 : -.55;
  if (hero.top < .5 - (.06 - heroY0) * base / 2 + .11 * base) {
    const avail = Math.max(.12, hero.top - hero.bar);
    base = Math.min(base, avail * .9 / .37);
    heroY0 = .06 - (.5 - (hero.bar + avail / 2)) * 2 / base;
  }
  const Zf = Math.max(base * 3, 1.08 * Math.sqrt(1 + a * a) / RP_FINAL);
  st.base = base; st.Zf = Zf;
  const d0 = S.pupila - .45, d1 = plan.d1;               // mergulho na pupila
  const o0 = S.fim - .3, o1 = S.fim + 1.1;                // a câmera sai da pupila
  const ending = Tv >= o0;
  st.mode = Tv < d1 || ending ? 0 : 1;
  // olho
  const dp = ending ? 1 - clamp01((Tv - o0) / (o1 - o0)) : clamp01((Tv - d0) / (d1 - d0));
  st.dp = dp;
  const push = ending ? 1 : 1 + .06 * smooth(0, 1, Tv / Math.max(.01, d0)) * (1 - dp);
  st.zoom = base * Math.exp(Math.log(Zf / base) * inOutCubic(dp)) * push;
  let g = reduced ? [0, 0] : gazeAt(clk);
  if (live && pf.w > .001) g = [lerp(g[0], pf.x, pf.w), lerp(g[1], pf.y, pf.w)];
  const focus = ending ? 1 : smooth(0, .28, dp);
  const gx = g[0] * (1 - focus), gy = g[1] * (1 - focus), mic = reduced ? 0 : 1 - focus;
  st.iris = [gx * .42 + mic * (.003 * Math.sin(clk * 3.1) + .0015 * Math.sin(clk * 7.3)), gy * .06 + mic * .002 * Math.cos(clk * 2.3)];
  st.look = gx;
  const track = smooth(.05, .45, dp);
  const heroY = ending ? 0 : heroY0 * (1 - smooth(0, .35, dp));
  st.camC = [st.iris[0] * track, st.iris[1] * track + heroY];
  if (ending) {
    const w = 1 - smooth(.2, .9, dp);
    if (a >= 1) { st.zoom *= 1 - .1 * w; st.camC[0] -= 2 * a * .17 * w / st.zoom; }
    else st.camC[1] = lerp(st.camC[1], -.5 / st.zoom, w);
  }
  st.pupil = lerp(reduced ? .09 : pupilAt(clk), RP_FINAL, smooth(.12, .7, dp));
  st.open = (reduced ? 1 : openIntro(clk)) * (ending ? 1 - smooth(S.fim + 1.35, S.fim + 1.95, Tv) : 1);
  st.catchA = 1 - smooth(.05, .4, dp);
  st.contentShow = ending ? 0 : smooth(.3, .78, dp);     // na volta, a pupila já está escura como a tela
  st.contentFull = smooth(.82, 1, dp);
  st.lodAdd = Math.max(0, Math.log2(Zf / st.zoom));
  // afrescos
  const fr = frescoAt(Tv);
  st.fA = fr.A; st.fB = fr.B; st.mix = fr.mix;
  st.camA = camOf(fr.A, Tv); st.camB = fr.mix > 0 ? camOf(fr.B, Tv) : st.camA;
  st.decode = keyLin(plan.decode, Tv);
  st.text = Tv < plan.tText ? 'verbo' : 'arvore';
  const w = waveAt(Tv);
  st.wave = toScreen(camOf(w[1], Tv), w[2], w[3]);
  const lt = plan.lights[fr.A];
  st.light = lt && fr.mix === 0 ? [lt.p[0], lt.p[1], lt.p[2], smooth(lt.t0, lt.t1, Tv) * (1 - smooth(lt.t2, lt.t3, Tv))] : [0, 0, 1, 0];
  st.lightK = lt ? lt.k : [0, 0]; st.lightCol = lt ? lt.col : [1, 1, 1];
  st.spot = lt && lt.spot && st.mode === 1 && st.light[3] > 0 ? [...toScreen(st.camA, lt.p[0], lt.p[1]), lt.spot[0] * st.light[3], lt.spot[1]] : null;
  // o toque: os dedos se encostam e o clarão enche a tela; Eva aparece quando ele se apaga
  st.spark = fr.A === 'adao' ? smooth(S.toque + 1.45, S.toque + 1.85, Tv) : 0;
  st.touch = fr.A === 'adao' ? smooth(S.toque + 1, plan.tTouch, Tv) : 0;
  const fl = smooth(plan.tTouch - .04, plan.tTouch + .26, Tv);
  st.flashR = Tv < plan.tEva && fl > 0 ? 2.8 * Math.pow(fl, 1.7) : 0;
  st.flashW = smooth(plan.tTouch + .14, plan.tTouch + .26, Tv) * (1 - smooth(plan.tEva + .04, S.eva + .35, Tv));
  st.flashC = toScreen(camOf('adao', Tv), GAP[0], GAP[1]);
  st.flashCore = lerp(.25, .45, smooth(plan.tTouch + .1, plan.tEva + .3, Tv));   // o núcleo de luz cresce enquanto dura o clarão
  st.burst = Tv < plan.tEva ? Math.max(st.flashW, fl) : st.flashW;
  // Éden: a serpente se escreve, a espada pega fogo, as cores se apagam, as letras caem
  st.snakeAmt = smooth(S.eden + 1.25, S.eden + 1.75, Tv) * (1 - smooth(S.espada - .3, S.espada + .1, Tv));
  st.fire = fr.A === 'pecado' && fr.mix === 0 ? smooth(S.espada + .35, S.espada + 1.05, Tv) : 0;
  st.wither = smooth(S.queda - .2, S.queda + .5, Tv);
  st.fall = clamp01((Tv - (S.queda + .15)) / (S.fim - .45 - (S.queda + .15)));
  // letras
  st.words = st.mode === 1 || !ending ? 1 : 0;
  st.starAmt = st.mode === 1 ? 1 - st.fall : 0;
  st.fallA = st.mode === 1 ? st.fall : 0;
  return st;
}
function chapterAt(Tv) {
  let cur = 'olho';
  for (const s of sections) if (Tv + .45 >= secT[s.id]) cur = s.id;
  return cur;
}
function snapT(Tv) { let best = stops[0]; for (const v of stops) if (Math.abs(v - Tv) < Math.abs(best - Tv)) best = v; return best; }

/* ---------- modo filme: rola a página sozinho, com a mesma curva usada para gravar o vídeo ---------- */
const FILM_INTRO = 5.4, FILM_HZ = 120;
const film = { on: false, t: 0, table: new Float32Array([0]), dur: 0, lastY: null };
function filmSpeed(Tv) {
  const S = secT;
  let v = .36;
  v *= 1 - .4 * bump(Tv, S.verbo + .9, .45);     // as palavras viram imagem
  v *= 1 - .5 * bump(Tv, S.toque + 1.9, .5);     // o toque
  v *= 1 - .3 * bump(Tv, S.eva + .4, .45);       // Eva surge do clarão
  v *= 1 - .35 * bump(Tv, S.eden + .3, .45);     // o mandamento, escrito
  v *= 1 - .3 * bump(Tv, S.eden + 2, .5);        // a serpente, escrita
  v *= 1 - .3 * bump(Tv, S.espada + 1.3, .6);    // a espada em chamas
  v *= 1 - .45 * bump(Tv, S.fim + 1.7, .5);      // o olho se fecha
  return v;
}
function buildFilm() {
  const arr = []; let Tv = 0, t = 0;
  while (t < 400) {
    arr.push(Tv);
    if (Tv >= maxT) break;
    t += 1 / FILM_HZ;
    if (t > FILM_INTRO) Tv = Math.min(maxT, Tv + filmSpeed(Tv) * smooth(0, 1.4, t - FILM_INTRO) / FILM_HZ);
  }
  for (let i = 0; i < FILM_HZ * 2.5; i++) arr.push(Tv);
  film.table = Float32Array.from(arr); film.dur = arr.length / FILM_HZ;
}
function filmT(t) {
  const tb = film.table, i = clamp(t, 0, film.dur) * FILM_HZ, i0 = Math.floor(i);
  if (i0 >= tb.length - 1) return tb[tb.length - 1];
  return lerp(tb[i0], tb[i0 + 1], i - i0);
}
const filmBtns = [...document.querySelectorAll('[data-film]')];
function setFilm(on) {
  film.on = on; film.lastY = null;
  filmBtns.forEach(b => { b.classList.toggle('is-on', on); const s = b.hasAttribute('data-short'); b.textContent = on ? (s ? 'Parar' : 'Parar filme') : (s ? 'Filme' : 'Assistir como filme'); });
}
function startFilm() {
  const cur = scrollY / unit;
  if (cur < .02) film.t = Math.min(clock, FILM_INTRO);
  else { const tb = film.table; let i = 0; while (i < tb.length - 1 && tb[i] < cur) i++; film.t = i / FILM_HZ; }
  if (film.t >= film.dur - 2.6) film.t = 0;
  if (film.t === 0) window.scrollTo({ top: 0, behavior: 'instant' });
  setFilm(true);
}
filmBtns.forEach(b => b.addEventListener('click', () => film.on ? setFilm(false) : startFilm()));
const stopFilm = () => { if (film.on) setFilm(false); };
const offFilmBtn = e => !(e.target && e.target.closest && e.target.closest('[data-film]'));
addEventListener('wheel', stopFilm, { passive: true });
addEventListener('touchstart', e => { if (offFilmBtn(e)) stopFilm(); }, { passive: true });
addEventListener('touchmove', stopFilm, { passive: true });
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) stopFilm();
  else if ((e.key === ' ' || e.key === 'Enter') && !(e.target.closest && e.target.closest('button'))) stopFilm();
});
// links internos (abas, "Voltar ao olho"): o filme para antes de a página rolar até o capítulo
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('a[href^="#"]')) stopFilm(); });
addEventListener('hashchange', stopFilm);

/* ---------- desenho ---------- */
let clock = 0, T = 0, last = performance.now(), snapNext = false;
let fpsAcc = 0, fpsN = 0, fps = 60, lowFor = 0, statT = 0;
const elZoom = document.getElementById('st-zoom'), elGrid = document.getElementById('st-grid'), elFps = document.getElementById('st-fps');
const tabsEl = document.querySelector('.tabs');
const tabs = [...document.querySelectorAll('.tabs a')];
let curCh = '';

function draw(st) {
  const v = view;
  const FA = FRESCO[st.fA], FB = FRESCO[st.fB], FAd = FRESCO.adao, FP = FRESCO.pecado;
  gl.bindVertexArray(vao);
  // passo 1
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, v.cols, v.rows);
  gl.useProgram(P1.p);
  set(P1, 'uGrid', v.cols, v.rows); set(P1, 'uCellPx', v.cwd, v.chd); set(P1, 'uOffsetPx', v.ox, v.oy); set(P1, 'uView', v.w, v.h);
  set(P1, 'uTime', st.clk); set(P1, 'uAspect', v.aspect); set(P1, 'uMode', st.mode);
  set(P1, 'uCamC', st.camC[0], st.camC[1]); set(P1, 'uZoom', st.zoom);
  set(P1, 'uIris', st.iris[0], st.iris[1]); set(P1, 'uLook', st.look); set(P1, 'uPupil', st.pupil); set(P1, 'uOpen', st.open); set(P1, 'uCatch', st.catchA);
  set(P1, 'uContentShow', st.contentShow); set(P1, 'uContentFull', st.contentFull);
  set(P1, 'uContentZf', st.Zf); set(P1, 'uLodAdd', st.lodAdd);
  set(P1, 'uSizeA', FA.w, FA.h); set(P1, 'uSizeB', FB.w, FB.h);
  set(P1, 'uCamA', ...st.camA); set(P1, 'uCamB', ...st.camB);
  set(P1, 'uLodA', lodOf(FA, st.camA)); set(P1, 'uLodB', lodOf(FB, st.camB));
  set(P1, 'uMix', st.mix); set(P1, 'uWither', st.wither);
  set(P1, 'uMaskOn', st.fA === 'pecado' && st.mix === 0 && maskTex ? 1 : 0);
  set(P1, 'uSpark', st.spark); set(P1, 'uTouch', st.touch);
  set(P1, 'uSparkAB', PTS.adao.tipA[0] * FAd.w, PTS.adao.tipA[1] * FAd.h, PTS.adao.tipG[0] * FAd.w, PTS.adao.tipG[1] * FAd.h);
  const sw = PTS.pecado.sword;
  set(P1, 'uFire', st.fire); set(P1, 'uSword', sw[0] * FP.w, sw[1] * FP.h, sw[2] * FP.w, sw[3] * FP.h);
  set(P1, 'uLight', st.light[0] * FA.w, st.light[1] * FA.h, Math.max(1, st.light[2] * FA.w), st.light[3]);
  set(P1, 'uLightK', ...st.lightK); set(P1, 'uLightCol', ...st.lightCol); set(P1, 'uSnakeK', st.snakeAmt, .3);
  set(P1, 'uFlash', st.flashW, st.flashR, st.flashCore); set(P1, 'uFlashC', st.flashC[0], st.flashC[1]);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ftex[st.fA]); gl.uniform1i(P1.u.uTexA, 0);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, ftex[st.fB]); gl.uniform1i(P1.u.uTexB, 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, maskTex || blankTex); gl.uniform1i(P1.u.uMaskA, 4);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // passo 2
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, v.w, v.h);
  gl.useProgram(P2.p);
  set(P2, 'uGrid', v.cols, v.rows); set(P2, 'uCellPx', v.cwd, v.chd); set(P2, 'uOffsetPx', v.ox, v.oy); set(P2, 'uView', v.w, v.h);
  set(P2, 'uAtlasGrid', atlas.cols, atlas.rows); set(P2, 'uRampN', atlas.rampN); set(P2, 'uTextBase', atlas.textBase);
  set(P2, 'uTxtWords', ...atlas.txt[st.text]); set(P2, 'uTxtSnake', ...atlas.txt.serpente);
  set(P2, 'uTime', st.clk); set(P2, 'uFlicker', (paused || reduced) ? 0 : .035);
  set(P2, 'uWords', st.words); set(P2, 'uDecode', st.decode); set(P2, 'uStars', ...atlas.stars); set(P2, 'uStarAmt', st.starAmt);
  set(P2, 'uSnakeAmt', st.snakeAmt); set(P2, 'uFall', st.fallA);
  set(P2, 'uFade', reduced ? 1 : smooth(0, .9, st.clk));
  set(P2, 'uToneE', ...TONE.eye); set(P2, 'uToneF', ...TONE.fresco); set(P2, 'uGlowLod', Math.log2(GW / v.cwd) + 1.8);
  set(P2, 'uBurst', st.flashC[0] * v.w, (1 - st.flashC[1]) * v.h, st.burst, st.flashCore * .55);
  if (st.spot) { set(P2, 'uSpot', st.spot[0] * v.w, (1 - st.spot[1]) * v.h, st.spot[2], st.spot[3]); set(P2, 'uSpotCol', ...st.lightCol); }
  else set(P2, 'uSpot', 0, 0, 0, 1);
  set(P2, 'uWave', (st.wave[0] * v.w - v.ox) / v.cwd, (st.wave[1] * v.h - v.oy) / v.chd);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, sceneTex); gl.uniform1i(P2.u.uScene, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, atlasTex); gl.uniform1i(P2.u.uAtlas, 1);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, textTex); gl.uniform1i(P2.u.uText, 2);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function zoomStat(st) {
  if (st.mode === 0) return st.zoom / st.base;
  return st.Zf / st.base * fview(st.fA, 1)[1] / st.camA[3];
}
function showStats(st) {
  elZoom.textContent = `zoom ×${zoomStat(st).toFixed(1)}`;
  elGrid.textContent = `${(view.cols * view.rows).toLocaleString('pt-BR')} letras`;
  elFps.textContent = `${Math.round(fps)} fps`;
}
const fimCap = document.querySelector('#fim .cap');
let fimOp = '';
function showEndCap(st) {   // no celular, a última legenda some antes de passar por cima do olho
  let op = '';
  if (fimCap && view.aspect < 1 && st.T >= secT.fim - .3) {
    const eyeBottom = (.5 + (.33 + st.camC[1]) * st.zoom / 2) * innerHeight;
    const top = fimCap.getBoundingClientRect().top;
    op = String(Math.round(clamp01((top - eyeBottom - 12) / 60) * 100) / 100);
  }
  if (op !== fimOp) { fimOp = op; fimCap.style.opacity = op; }
}
let flashCss = -1;
const toqueEl = document.getElementById('toque');
function showFlash(st) {   // as legendas acompanham o clarão: tinta escura sobre a luz
  const f = Math.round(smooth(.4, .85, st.burst || 0) * 100) / 100;
  if (f !== flashCss) { flashCss = f; toqueEl?.style.setProperty('--flash', String(f)); }
}
function showChapter(Tv) {
  const ch = chapterAt(Tv);
  if (ch === curCh) return;
  curCh = ch;
  tabs.forEach(a => a.dataset.ch === ch ? a.setAttribute('aria-current', 'step') : a.removeAttribute('aria-current'));
  const a = tabs.find(x => x.dataset.ch === ch);
  if (a && tabsEl.scrollWidth > tabsEl.clientWidth + 2) tabsEl.scrollTo({ left: a.offsetLeft - tabsEl.clientWidth / 2 + a.offsetWidth / 2, behavior: (reduced || capture) ? 'auto' : 'smooth' });
}

function frame(now) {
  if (lost) return;
  requestAnimationFrame(frame);
  const rawDt = (now - last) / 1000; last = now;
  const dt = Math.min(.05, Math.max(0, rawDt));
  if (!paused && !reduced) clock += dt;
  if (film.on) {
    // se a página rolou por outro motivo (barra de rolagem, busca, teclado), quem manda é o usuário
    if (film.lastY != null && Math.abs(scrollY - film.lastY) > 3) setFilm(false);
    else {
      if (!paused) film.t += dt;
      window.scrollTo({ top: filmT(film.t) * unit, behavior: 'instant' });
      film.lastY = scrollY;
      if (film.t >= film.dur) setFilm(false);
    }
  }
  const target = fixedT != null ? fixedT : scrollY / unit;
  if (reduced) T = snapT(target);
  else if (fixedT != null || clock < .9 || snapNext) { T = target; snapNext = false; }   // ao abrir no meio da história, não passa por tudo antes
  else { T += (target - T) * (1 - Math.exp(-dt * 5.2)); if (Math.abs(target - T) < 1e-4) T = target; }
  updatePointer(dt);
  const st = frameState(T, fixedClock != null ? fixedClock : clock, true);
  draw(st);
  showFlash(st); showEndCap(st);
  if (rawDt > 0 && rawDt < 1) { fpsAcc += rawDt; fpsN++; }
  if (now - statT > 300) {
    statT = now;
    if (fpsN) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    showStats(st);
    // qualidade adaptativa: cai rápido, nunca abaixo de 1×
    if (!document.hidden && fps < 40 && view.dpr > 1) { lowFor += .3; if (lowFor > 2) { qualityCap = Math.max(1, view.dpr - .25); lowFor = 0; resize(); } } else lowFor = 0;
  }
  showChapter(target);
}

/* ---------- controles ---------- */
const pauseBtns = [...document.querySelectorAll('[data-pause]')];
function setPaused(v) {
  paused = v;
  root.classList.toggle('is-paused', v);
  pauseBtns.forEach(b => { b.classList.toggle('is-on', v); b.textContent = v ? (b.closest('.panel') ? 'Continuar animação' : 'Continuar') : (b.closest('.panel') ? 'Pausar animação' : 'Pausar'); });
}
pauseBtns.forEach(b => b.addEventListener('click', () => setPaused(!paused)));
document.getElementById('b-more').addEventListener('click', () => { cellCss = Math.max(4, cellCss - 1); resize(); });
document.getElementById('b-less').addEventListener('click', () => { cellCss = Math.min(16, cellCss + 1); resize(); });
mqReduce.addEventListener?.('change', e => { reduced = e.matches; });
let lost = false;
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; fallback(); });
canvas.addEventListener('webglcontextrestored', () => {
  root.classList.remove('no-gl');          // primeiro: com o canvas escondido, a largura é 0 e a grade sairia 1×1
  try { initPrograms(); } catch (err) { console.error(err); fallback(); return; }
  atlasTex = null; textTex = null; sceneTex = null; fbo = null;   // objetos do contexto perdido não valem mais
  makeFrescoTextures();
  buildAtlas();
  resize();
  lost = false;
  if (!capture) requestAnimationFrame(t => { last = t; frame(t); });
});

/* ---------- ganchos para testes e para gravar o vídeo quadro a quadro ---------- */
let gsapBase = 0;
function renderAt(clk, Tv) {
  clock = clk; T = Tv;
  window.scrollTo({ top: Tv * unit, behavior: 'instant' });
  if (window.ScrollTrigger) ScrollTrigger.update();
  if (window.gsap && capture) gsap.updateRoot(gsapBase + clk);
  const st = frameState(Tv, clk, false);
  draw(st);
  showFlash(st); showEndCap(st);
  fps = 30; showStats(st); showChapter(Tv);
  return st;
}
window.__site = {
  ready: false,
  setT: v => { fixedT = v; },
  state: () => ({ T, secT: { ...secT }, view: { ...view }, maxT, film: { dur: film.dur }, stops: [...stops], st: frameState(T, clock, false) }),
  renderAt,
  renderFilm: t => renderAt(t, filmT(t)).T,
  filmDur: () => film.dur
};

/* ---------- início ---------- */
async function start() {
  try {
    await Promise.race([Promise.all([document.fonts.load('600 64px "JetBrains Mono"'), document.fonts.load('800 66px "JetBrains Mono"')]), new Promise(r => setTimeout(r, 2500))]);
  } catch (e) { /* segue com a fonte de reserva */ }
  buildAtlas();
  resize();
  initText();
  if (capture) {
    if (window.gsap) { gsap.ticker.remove(gsap.updateRoot); gsapBase = gsap.ticker.time + 1; }
    await imgReady;
    measure();
    window.__site.ready = true;
    return;
  }
  requestAnimationFrame(t => { last = t; frame(t); });
  addEventListener('load', () => { measure(); snapNext = true; window.ScrollTrigger && ScrollTrigger.refresh(); });
}
start();

/* ---------- legendas que se decifram (GSAP ScrambleText) ---------- */
function initText() {
  if (initText.done) return; initText.done = true;
  if (reduced || !window.gsap || !window.ScrollTrigger || !window.ScrambleTextPlugin) return;
  gsap.registerPlugin(ScrollTrigger, ScrambleTextPlugin);
  document.querySelectorAll('[data-scramble]').forEach(el => {
    const text = el.textContent;
    const run = () => gsap.to(el, { duration: Math.min(2, .7 + text.length * .028), ease: 'none', overwrite: true,
      scrambleText: { text, chars: '#%&@$*+=:;!?/|<>[]{}~^', speed: .55, revealDelay: .1 } });
    ScrollTrigger.create({ trigger: el, start: 'top 88%', end: 'bottom 12%', onEnter: run, onEnterBack: run });
  });
}
}
