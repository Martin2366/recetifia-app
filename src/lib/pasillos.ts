/**
 * Pasillo del supermercado de cada ingrediente, adivinado por palabras clave y
 * en el telefono: nada de IA, cero costo. Los ids son los de la tabla aisles.
 * Incluye los nombres de varios paises (palta/aguacate, choclo/elote,
 * poroto/frijol/caraota...). Si no reconoce nada, va a "otros".
 */

export type Pasillo =
  | 'frutas-verduras'
  | 'carniceria'
  | 'pescaderia'
  | 'lacteos'
  | 'panaderia'
  | 'abarrotes'
  | 'condimentos'
  | 'congelados'
  | 'bebidas'
  | 'limpieza'
  | 'otros';

/** Orden de recorrido del supermercado, igual que aisles.position. */
export const PASILLOS: { id: Pasillo; nombre: string; emoji: string }[] = [
  { id: 'frutas-verduras', nombre: 'Frutas y verduras', emoji: '🥬' },
  { id: 'carniceria', nombre: 'Carnes y aves', emoji: '🥩' },
  { id: 'pescaderia', nombre: 'Pescados y mariscos', emoji: '🐟' },
  { id: 'lacteos', nombre: 'Lácteos y huevos', emoji: '🧀' },
  { id: 'panaderia', nombre: 'Panadería', emoji: '🥖' },
  { id: 'abarrotes', nombre: 'Abarrotes y despensa', emoji: '🥫' },
  { id: 'condimentos', nombre: 'Aliños y condimentos', emoji: '🧂' },
  { id: 'congelados', nombre: 'Congelados', emoji: '🧊' },
  { id: 'bebidas', nombre: 'Bebidas', emoji: '🥤' },
  { id: 'limpieza', nombre: 'Limpieza y hogar', emoji: '🧽' },
  { id: 'otros', nombre: 'Otros', emoji: '🛒' },
];

// El orden importa: lo mas especifico primero ("leche de coco" antes que "leche",
// "pimienta" antes que "pimiento", "caldo de pollo" antes que "pollo").
const REGLAS: [Pasillo, string[]][] = [
  ['congelados', ['congelad', 'helado', 'hielo']],
  ['abarrotes', ['leche de coco', 'leche condensada', 'leche evaporada', 'crema de coco', 'caldo', 'consome', 'cubito', 'pure de tomate', 'salsa de tomate', 'tomate triturado', 'pasta de tomate']],
  ['condimentos', ['pimienta', 'sal ', 'sal,', 'comino', 'oregano', 'paprika', 'pimenton', 'ajo en polvo', 'cebolla en polvo', 'canela', 'nuez moscada', 'curcuma', 'curry', 'aji molido', 'merken', 'aji color', 'laurel', 'tomillo', 'romero seco', 'clavo de olor', 'vinagre', 'salsa de soya', 'salsa de soja', 'sillao', 'mostaza', 'mayonesa', 'ketchup', 'salsa inglesa', 'aceite', 'especia', 'sazon', 'adobo', 'jengibre en polvo', 'polvo de hornear', 'bicarbonato', 'esencia de vainilla', 'vainilla', 'levadura', 'gelatina']],
  ['pescaderia', ['pescado', 'salmon', 'atun fresco', 'merluza', 'reineta', 'tilapia', 'corvina', 'bacalao', 'camaron', 'camarones', 'langostino', 'gamba', 'pulpo', 'calamar', 'mejillon', 'chorito', 'almeja', 'marisco', 'jaiba', 'cangrejo']],
  ['carniceria', ['pollo', 'pechuga', 'muslo', 'trutro', 'carne', 'res', 'vacuno', 'lomo', 'posta', 'bistec', 'bife', 'molida', 'picada', 'cerdo', 'chancho', 'costilla', 'tocino', 'panceta', 'tocineta', 'jamon', 'chorizo', 'salchicha', 'longaniza', 'pavo', 'cordero', 'higado', 'filete']],
  ['lacteos', ['leche', 'queso', 'mantequilla', 'manteca', 'margarina', 'crema', 'nata', 'yogur', 'yoghurt', 'huevo', 'yema', 'clara', 'requeson', 'ricota', 'ricotta', 'mozzarella', 'parmesano', 'pecorino', 'quesillo', 'suero']],
  ['panaderia', ['pan ', 'pan,', 'pan de', 'baguette', 'marraqueta', 'hallulla', 'tortilla', 'arepa', 'pan molido', 'pan rallado', 'galleta', 'bizcocho', 'masa de hojaldre']],
  ['abarrotes', ['harina', 'maicena', 'fecula', 'arroz', 'fideo', 'pasta', 'espagueti', 'spaghetti', 'tallarin', 'macarron', 'lenteja', 'garbanzo', 'poroto', 'frijol', 'caraota', 'habichuela', 'azucar', 'panela', 'chancaca', 'miel', 'avena', 'quinoa', 'quinua', 'chocolate', 'cacao', 'cafe', 'te ', 'mani', 'almendra', 'nuez', 'nueces', 'pasas', 'coco rallado', 'atun', 'sardina', 'lata', 'enlatad', 'conserva', 'mermelada', 'dulce de leche', 'manjar', 'cereal', 'polenta', 'semola', 'chia', 'linaza']],
  ['bebidas', ['agua mineral', 'agua con gas', 'jugo', 'zumo', 'vino', 'cerveza', 'gaseosa', 'bebida', 'refresco', 'soda', 'ron', 'pisco', 'tequila', 'vodka']],
  ['frutas-verduras', ['tomate', 'jitomate', 'cebolla', 'cebollin', 'ajo', 'papa', 'patata', 'camote', 'batata', 'zanahoria', 'zapallo', 'calabaza', 'auyama', 'zucchini', 'calabacin', 'pimiento', 'morron', 'aji', 'chile', 'jalapeno', 'lechuga', 'espinaca', 'acelga', 'repollo', 'col', 'brocoli', 'coliflor', 'pepino', 'berenjena', 'champinon', 'hongo', 'seta', 'choclo', 'elote', 'maiz', 'arveja', 'guisante', 'poroto verde', 'ejote', 'apio', 'puerro', 'cilantro', 'perejil', 'albahaca', 'menta', 'hierbabuena', 'romero', 'palta', 'aguacate', 'limon', 'lima', 'naranja', 'manzana', 'platano', 'banana', 'banano', 'guineo', 'fresa', 'frutilla', 'mora', 'arandano', 'pina', 'mango', 'papaya', 'maracuya', 'durazno', 'melocoton', 'pera', 'uva', 'kiwi', 'sandia', 'melon', 'coco', 'jengibre', 'kion', 'rabano', 'betarraga', 'remolacha', 'yuca', 'mandioca', 'fruta', 'verdura']],
  ['limpieza', ['papel', 'servilleta', 'detergente', 'lavaloza', 'esponja', 'bolsa']],
];

// Marcas diacriticas que deja normalize('NFD'): las tildes y la dieresis
const TILDES = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, 'g');

function normalizar(texto: string): string {
  return ` ${texto
    .toLowerCase()
    .normalize('NFD')
    .replace(TILDES, '')
    .replace(/[^a-z0-9 ,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;
}

export function pasilloDe(nombre: string): Pasillo {
  const t = normalizar(nombre);
  for (const [pasillo, claves] of REGLAS) {
    // Solo al comienzo de una palabra: "aji" no atrapa "naranja" ni "col"
    // atrapa "chocolate". Las claves que terminan en espacio o coma ("sal ")
    // exigen ademas la palabra completa, para que "sal" no atrape "salsa".
    if (claves.some((c) => t.includes(` ${c}`))) return pasillo;
  }
  return 'otros';
}

/** Nombre comparable para juntar duplicados: sin tildes, mayusculas ni plurales simples. */
export function nombreComparable(nombre: string): string {
  // Quitar la s y luego la e final deja igual singular y plural en los dos
  // casos del espanol: tomate/tomates -> tomat, limon/limones -> limon
  return normalizar(nombre)
    .trim()
    .replace(/s$/, '')
    .replace(/e$/, '');
}
