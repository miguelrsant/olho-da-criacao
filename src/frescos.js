// Afrescos já tratados (céu e reboco escurecidos, figuras realçadas) pelo treat.py do projeto original.
// O Vite cuida das imagens: na build elas ganham nome com hash e cache longo.
import adao from './assets/adao.jpg';
import eva from './assets/eva.jpg';
import luz from './assets/luz.jpg';
import pecado from './assets/pecado.jpg';
import pecadoMask from './assets/pecado-mask.png';

export const FRESCOS = {
  luz: { src: luz, w: 834, h: 1050 },
  adao: { src: adao, w: 1200, h: 608 },
  eva: { src: eva, w: 1000, h: 712 },
  pecado: { src: pecado, w: 1000, h: 438, mask: pecadoMask },
};
