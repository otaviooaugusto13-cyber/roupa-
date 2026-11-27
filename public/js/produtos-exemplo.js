/* Taxonomia: gender = m | f | u (unissex aparece em Masculino e Feminino); sub = subcategoria (ver js/catalogo.js).
   cat = grupo: camisetas | moletons | treino | baixo. Os 16 últimos produtos ainda não têm foto: o front desenha o mockup SVG até você enviar as fotos reais.
   Produtos de exemplo — FONTE ÚNICA.
   Usados por: server/seed.js (popular o Firestore) e js/api.js (fallback quando a API está fora do ar).
   Formato legado do index.html original; o seed converte para o modelo do Firestore (seção 4). */
const U = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

export const PRODUTOS_EXEMPLO = [
  { id:'voltage', name:'Voltage Oversized', cat:'camisetas', type:'tee', gender:'u', sub:'oversized', col:'Frequência', badge:'new', price:189.9,
    color:'#141417', ink:'#A855F7', word:'VOLTAGE', bg:['#1d1b24','#0c0c10'], soldout:['XGG'],
    fit:'Oversized', desc:'Camiseta oversized em algodão peruano penteado, com estampa frontal discreta e arte de costas em tinta refletiva que brilha sob flash.',
    feats:['100% algodão peruano','Gramatura 240 g/m²','Modelagem oversized','Gola ribana 2,5 cm','Estampa refletiva','Pré-encolhida'],
    photos:{ front:U('1583743814966-8936f5b7be1a'), back:U('1618354691373-d851c5c3a990') }, gif:'' },
  { id:'static-bloom', name:'Static Bloom Tee', cat:'camisetas', type:'tee', gender:'u', sub:'oversized', col:'', badge:'ltd', price:219.9,
    color:'#ECEAE4', ink:'#7C3AED', word:'BLOOM', bg:['#2a2633','#121116'], soldout:['P'],
    fit:'Oversized', desc:'Off-white encorpada com arte floral distorcida em silk de alta densidade. Drop limitado, numerado na etiqueta interna.',
    feats:['100% algodão peruano','Gramatura 240 g/m²','Silk alta densidade','Etiqueta numerada','Ombro caído','Barra reta'],
    photos:{ front:U('1521572163474-6864f9cf17ab'), back:U('1576566588028-4147f3842f27') }, gif:'' },
  { id:'night-shift', name:'Night Shift Hoodie', cat:'moletons', type:'hoodie', gender:'m', sub:'canguru', col:'Noturno', badge:'new', price:449.9,
    color:'#2A2A2E', ink:'#A855F7', word:'NIGHT', bg:['#1a1a20','#09090b'], soldout:[],
    fit:'Relaxed', desc:'Moletom canguru três cabos, felpado por dentro, com capuz duplo e bordado tonal no peito. Feito para virar a madrugada.',
    feats:['Moletom 3 cabos 420 g/m²','Interior felpado','Capuz forro duplo','Bolso canguru','Punhos em ribana','Bordado tonal'],
    photos:{ front:U('1556821840-3a63f95609a7'), back:U('1620799140408-edc6dcb6d633') }, gif:'' },
  { id:'signal-lost', name:'Signal Lost Boxy', cat:'camisetas', type:'tee', gender:'u', sub:'oversized', col:'Frequência', badge:'', price:199.9,
    color:'#4C1D95', ink:'#E9D5FF', word:'NO SIGNAL', bg:['#221a33','#0d0b12'], soldout:[],
    fit:'Boxy', desc:'Corte boxy curto em roxo profundo tingido em peça, com gráfico de interferência de TV nas costas.',
    feats:['100% algodão peruano','Gramatura 240 g/m²','Modelagem boxy','Tingimento em peça','Comprimento cropped','Costura dupla'],
    photos:{ front:U('1503341504253-dff4815485f1'), back:U('1622445275463-afa2ab738c34') }, gif:'' },
  { id:'afterhours', name:'Afterhours Zip Hoodie', cat:'moletons', type:'hoodie', gender:'u', sub:'canguru', col:'Noturno', badge:'ltd', price:489.9,
    color:'#0F0F12', ink:'#C084FC', word:'AFTER', bg:['#16141c','#060608'], soldout:['M','GG'],
    fit:'Oversized', desc:'Zip hoodie preto com zíper YKK duplo cursor e faixa refletiva nas mangas. Tiragem de 150 peças.',
    feats:['Moletom 3 cabos 450 g/m²','Zíper YKK duplo cursor','Faixa refletiva','Capuz forrado','Bolsos laterais','150 peças'],
    photos:{ front:U('1578681994506-b8f463449011'), back:U('1565693413579-8ff3fdc1b03b') }, gif:'' },
  { id:'grid-runner', name:'Grid Runner Longline', cat:'camisetas', type:'tee', gender:'u', sub:'oversized', col:'', badge:'', price:179.9,
    color:'#D4D4D8', ink:'#18181B', word:'GRID', bg:['#26262c','#111114'], soldout:[],
    fit:'Longline', desc:'Camiseta longline cinza gelo com barra arredondada e grid técnico impresso nas costas.',
    feats:['100% algodão peruano','Gramatura 220 g/m²','Modelagem longline','Barra curva','Estampa técnica','Toque macio'],
    photos:{ front:U('1529374255404-311a2a4f1fd9'), back:U('1562157873-818bc0726f68') }, gif:'' },
  { id:'neon-static', name:'Neon Static Crewneck', cat:'moletons', type:'hoodie', gender:'u', sub:'careca', crew:true, col:'Noturno', badge:'new', price:359.9,
    color:'#1F1B2E', ink:'#A855F7', word:'STATIC', bg:['#1d1830','#0a0910'], soldout:['XGG'],
    fit:'Relaxed', desc:'Crewneck em moletom peletizado com estampa puff em roxo neon que ganha relevo ao toque.',
    feats:['Moletom 3 cabos 400 g/m²','Estampa puff','Gola careca ribana','Interior felpado','Ombro caído','Barra em ribana'],
    photos:{ front:U('1572495641004-28421ae52e52'), back:U('1614975059251-992f11792b9f') }, gif:'' },
  { id:'frequency-03', name:'Frequency 03 Washed', cat:'camisetas', type:'tee', gender:'u', sub:'oversized', col:'Frequência', badge:'ltd', price:229.9,
    color:'#2B2B30', ink:'#D8B4FE', word:'FREQ 03', bg:['#24222b','#0e0e11'], soldout:['P','XGG'],
    fit:'Oversized', desc:'Preto estonado em lavagem enzimática, com gráfico de ondas sonoras e assinatura do drop 07.',
    feats:['100% algodão peruano','Gramatura 240 g/m²','Lavagem enzimática','Modelagem oversized','Estampa craquelada','Cada peça é única'],
    photos:{ front:U('1527719327859-c6ce80353573'), back:U('1574180566232-aaad1b5b8450') }, gif:'' },
];

const N = (o) => ({ badge:'', col:'', soldout:[], gif:'', photos:{ front:'', back:'' }, ...o });

PRODUTOS_EXEMPLO.push(
  // ---------- Camisas & partes de cima ----------
  N({ id:'core-slim', name:'Core Slim Tee', cat:'camisetas', type:'tee', gender:'m', sub:'basica', price:129.9, color:'#E7E5E4', ink:'#7C3AED', word:'CORE', bg:['#26242c','#101013'], fit:'Slim',
    desc:'Camiseta básica slim em malha penteada, gola ribana firme e caimento justo sem apertar. A peça-base de qualquer look.',
    feats:['100% algodão penteado','Gramatura 180 g/m²','Modelagem slim','Gola ribana 2 cm','Costura reforçada','Pré-encolhida'] }),
  N({ id:'machao-neon', name:'Regata Machão Neon', cat:'camisetas', type:'tank', gender:'m', sub:'regata-machao', badge:'new', price:119.9, color:'#141417', ink:'#A855F7', word:'MACHÃO', bg:['#1d1b24','#0c0c10'], soldout:['PP'], fit:'Regular',
    desc:'Regata machão com cava ampla e acabamento em viés neon. Leve, solta no ombro e pronta para o calor.',
    feats:['Malha 100% algodão','Gramatura 160 g/m²','Cava machão','Viés em roxo neon','Barra reta','Toque macio'] }),
  N({ id:'cavada-flux', name:'Regata Cavada Flux', cat:'camisetas', type:'tankdeep', gender:'m', sub:'regata-cavada', price:109.9, color:'#2B2B30', ink:'#D8B4FE', word:'FLUX', bg:['#24222b','#0e0e11'], fit:'Cavada',
    desc:'Regata cavada profunda com recorte lateral e estampa discreta no peito. Liberdade total de movimento.',
    feats:['Algodão com elastano','Gramatura 170 g/m²','Cava profunda','Estampa em silk','Barra curva','Secagem rápida'] }),
  N({ id:'thermal-long', name:'Thermal Manga Longa', cat:'camisetas', type:'longsleeve', gender:'u', sub:'manga-longa', price:169.9, color:'#18181B', ink:'#A855F7', word:'THERMAL', bg:['#1a1a20','#09090b'], soldout:['XGG'], fit:'Regular',
    desc:'Manga longa em malha encorpada com punhos em ribana e detalhe refletivo no antebraço. Para as noites frias da cidade.',
    feats:['Algodão encorpado','Gramatura 220 g/m²','Punhos em ribana','Detalhe refletivo','Gola careca','Pré-encolhida'] }),
  N({ id:'crop-pulse', name:'Cropped Pulse', cat:'camisetas', type:'crop', gender:'f', sub:'cropped', badge:'new', price:119.9, color:'#4C1D95', ink:'#E9D5FF', word:'PULSE', bg:['#221a33','#0d0b12'], fit:'Cropped',
    desc:'Cropped em roxo profundo com barra no ponto da cintura e estampa de pulso nas costas. Combina com cintura alta.',
    feats:['Algodão com elastano','Gramatura 190 g/m²','Modelagem cropped','Tingimento em peça','Gola ribana','Costura dupla'] }),

  // ---------- Moletons & casacos ----------
  N({ id:'wmn-oversized-hoodie', name:'Moletom Feminino Oversized', cat:'moletons', type:'hoodie', gender:'f', sub:'moletom-fem-oversized', price:379.9, color:'#2A2A2E', ink:'#C084FC', word:'SOFT', bg:['#1d1830','#0a0910'], col:'Noturno', fit:'Oversized',
    desc:'Moletom canguru oversized, felpado por dentro, com ombro caído e capuz volumoso. Conforto máximo para o dia inteiro.',
    feats:['Moletom 3 cabos 400 g/m²','Interior felpado','Ombro caído','Capuz forrado','Bolso canguru','Punhos em ribana'] }),
  N({ id:'wmn-crop-hoodie', name:'Moletom Feminino Cropped', cat:'moletons', type:'crophood', gender:'f', sub:'moletom-fem-cropped', badge:'ltd', price:349.9, color:'#1F1B2E', ink:'#A855F7', word:'CROP', bg:['#1a1a20','#09090b'], soldout:['PP','XGG'], col:'Noturno', fit:'Cropped',
    desc:'Moletom cropped com capuz e barra elástica na altura da cintura. Tiragem limitada em preto fosco com bordado roxo.',
    feats:['Moletom 3 cabos 380 g/m²','Barra elástica','Capuz forrado','Bordado tonal','Interior felpado','Tiragem limitada'] }),
  N({ id:'windbreaker-aero', name:'Corta-Vento Aero', cat:'moletons', type:'jacket', gender:'u', sub:'corta-vento', price:429.9, color:'#0F0F12', ink:'#A855F7', word:'AERO', bg:['#16141c','#060608'], fit:'Relaxed',
    desc:'Jaqueta corta-vento leve com tecido que repele garoa, zíper frontal e detalhes refletivos que acendem sob o flash.',
    feats:['Poliamida ripstop','Repelente a água','Zíper frontal YKK','Detalhes refletivos','Bolsos com zíper','Dobra no próprio bolso'] }),

  // ---------- Roupas de treino (performance) ----------
  N({ id:'dryfit-pro', name:'Dry-Fit Pro Tee', cat:'treino', type:'tee', gender:'m', sub:'dryfit', badge:'new', price:99.9, color:'#141417', ink:'#A855F7', word:'DRY-FIT', bg:['#1d1b24','#0c0c10'], fit:'Athletic',
    desc:'Camiseta dry-fit com malha que afasta o suor da pele, costura plana e corte athletic que acompanha o movimento.',
    feats:['Poliéster dry-fit','Secagem ultrarrápida','Proteção UV 50+','Costura plana','Painel ventilado nas costas','Antiodor'] }),
  N({ id:'regata-flow', name:'Regata Treino Flow', cat:'treino', type:'tankdeep', gender:'m', sub:'regata-treino', price:89.9, color:'#2B2B30', ink:'#D8B4FE', word:'FLOW', bg:['#24222b','#0e0e11'], fit:'Athletic',
    desc:'Regata de treino com cava profunda e tecido respirável. Feita para séries pesadas sem prender o ombro.',
    feats:['Poliéster respirável','Secagem rápida','Cava profunda','Costura plana','Elastano 8%','Antiodor'] }),
  N({ id:'short-run', name:'Short Treino Run', cat:'treino', type:'shorts', gender:'m', sub:'short-treino', price:109.9, color:'#18181B', ink:'#A855F7', word:'RUN', bg:['#1a1a20','#09090b'], fit:'Regular',
    desc:'Bermuda de treino com forro interno, bolso lateral com zíper e cós com cordão ajustável. Leve para correr e treinar.',
    feats:['Poliéster leve','Forro interno','Bolso com zíper','Cós com cordão','Detalhe refletivo','Secagem rápida'] }),
  N({ id:'legging-seamless', name:'Legging Seamless', cat:'treino', type:'legging', gender:'f', sub:'legging', badge:'new', price:179.9, color:'#2E1065', ink:'#E9D5FF', word:'SEAMLESS', bg:['#221a33','#0d0b12'], fit:'Compressão',
    desc:'Legging sem costura com cós alto e compressão média que modela sem marcar. Opaca no agachamento.',
    feats:['Poliamida com elastano','Sem costura lateral','Cós alto','Compressão média','Opacidade total','Secagem rápida'] }),
  N({ id:'top-seamless', name:'Top Seamless', cat:'treino', type:'bra', gender:'f', sub:'top', price:119.9, color:'#2E1065', ink:'#E9D5FF', word:'TOP', bg:['#221a33','#0d0b12'], fit:'Compressão',
    desc:'Top de treino com suporte médio, alças reguladas e bojo removível. Combina com a legging da mesma linha.',
    feats:['Poliamida com elastano','Suporte médio','Bojo removível','Alças reguladas','Sem costura','Secagem rápida'] }),

  // ---------- Partes de baixo ----------
  N({ id:'cargo-shadow', name:'Calça Cargo Shadow', cat:'baixo', type:'pants', gender:'u', sub:'cargo', price:329.9, color:'#27272A', ink:'#A855F7', word:'CARGO', bg:['#1d1b24','#0c0c10'], soldout:['PP'], fit:'Relaxed',
    desc:'Calça cargo em sarja com bolsos laterais de fole, barra ajustável e corte relaxado. Utilitária sem perder o visual limpo.',
    feats:['Sarja de algodão','Bolsos laterais de fole','Barra ajustável','Cintura com elástico','Corte relaxado','Pré-lavada'] }),
  N({ id:'jogger-flux', name:'Calça Jogger Flux', cat:'baixo', type:'jogger', gender:'u', sub:'jogger', badge:'new', price:279.9, color:'#18181B', ink:'#C084FC', word:'JOGGER', bg:['#16141c','#060608'], fit:'Tapered',
    desc:'Jogger em moletom leve com punho na barra, bolsos embutidos e cordão no cós. Conforto de moletom com cara de rua.',
    feats:['Moletom leve 320 g/m²','Punhos em ribana','Bolsos embutidos','Cordão no cós','Corte tapered','Interior macio'] }),
  N({ id:'short-street', name:'Short Streetwear Boxy', cat:'baixo', type:'shorts', gender:'m', sub:'short-street', price:189.9, color:'#4C1D95', ink:'#E9D5FF', word:'BOXY', bg:['#221a33','#0d0b12'], fit:'Boxy',
    desc:'Short boxy em sarja leve com comprimento no joelho, bolsos laterais e etiqueta bordada. Tingimento em peça.',
    feats:['Sarja leve','Comprimento no joelho','Bolsos laterais','Etiqueta bordada','Tingimento em peça','Cós com elástico'] }),
);
