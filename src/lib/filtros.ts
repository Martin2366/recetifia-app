/**
 * Filtros de busqueda de Descubrir. Modulo puro: lo usan la app, el script que
 * etiqueta el catalogo (scripts/catalogo.ts) y los tests.
 *
 * Cada opcion se guarda en `descubrir_recetas.etiquetas` como "categoria:id"
 * ("tipo:cena", "ing:pollo"). Dentro de una categoria se suman (pollo O
 * carne); entre categorias se cruzan (cena Y peruana).
 */

export type CategoriaFiltro = 'ing' | 'tipo' | 'dieta' | 'cocina' | 'ocasion' | 'metodo';

export type OpcionFiltro = { id: string; nombre: string; emoji: string };

export type Categoria = {
  id: CategoriaFiltro;
  nombre: string;
  /** "Filtrar por …" */
  titulo: string;
  emoji: string;
  fondo: string;
  buscar: string;
  opciones: OpcionFiltro[];
};

/**
 * Ingredientes: `claves` son raices sin tildes que se buscan como palabra
 * (con plural opcional) en los ingredientes de la receta. Incluyen como se
 * dice en cada pais: palta/aguacate, choclo/elote, porotos/frijoles.
 * Los `popular` van arriba en la hoja; el resto, por grupo.
 */
export type GrupoIngrediente = 'proteinas' | 'verduras' | 'frutas' | 'lacteos' | 'despensa';
export type Ingrediente = OpcionFiltro & { grupo: GrupoIngrediente; popular?: boolean; claves: string[] };

export const GRUPOS_INGREDIENTES: { id: GrupoIngrediente; nombre: string }[] = [
  { id: 'proteinas', nombre: 'Carnes y proteínas' },
  { id: 'verduras', nombre: 'Verduras y hierbas' },
  { id: 'frutas', nombre: 'Frutas' },
  { id: 'lacteos', nombre: 'Lácteos' },
  { id: 'despensa', nombre: 'Despensa' },
];

export const INGREDIENTES: Ingrediente[] = [
  { id: 'pollo', nombre: 'Pollo', emoji: '🍗', grupo: 'proteinas', popular: true, claves: ['pollo', 'pechuga', 'trutro', 'muslo'] },
  { id: 'huevo', nombre: 'Huevo', emoji: '🥚', grupo: 'proteinas', popular: true, claves: ['huevo', 'clara', 'yema'] },
  { id: 'carne-molida', nombre: 'Carne molida', emoji: '🥩', grupo: 'proteinas', popular: true, claves: ['carne molida', 'carne picada', 'molida de vacuno', 'carne de res molida'] },
  { id: 'vacuno', nombre: 'Carne de res', emoji: '🥩', grupo: 'proteinas', popular: true, claves: ['vacuno', 'res', 'bife', 'filete', 'lomo', 'posta', 'asado de tira', 'carne de res', 'ternera', 'entrana', 'punta de ganso'] },
  { id: 'cerdo', nombre: 'Cerdo', emoji: '🐖', grupo: 'proteinas', claves: ['cerdo', 'chancho', 'puerco', 'costilla', 'pernil', 'lomo de cerdo', 'chuleta'] },
  { id: 'pavo', nombre: 'Pavo', emoji: '🦃', grupo: 'proteinas', claves: ['pavo'] },
  { id: 'cordero', nombre: 'Cordero', emoji: '🐑', grupo: 'proteinas', claves: ['cordero', 'borrego'] },
  { id: 'tocino', nombre: 'Tocino', emoji: '🥓', grupo: 'proteinas', claves: ['tocino', 'panceta', 'bacon', 'tocineta', 'beicon'] },
  { id: 'jamon', nombre: 'Jamón', emoji: '🍖', grupo: 'proteinas', claves: ['jamon'] },
  { id: 'chorizo', nombre: 'Chorizo', emoji: '🌭', grupo: 'proteinas', claves: ['chorizo', 'longaniza'] },
  { id: 'salchicha', nombre: 'Salchichas', emoji: '🌭', grupo: 'proteinas', claves: ['salchicha', 'vienesa', 'hot dog', 'frankfurt'] },
  { id: 'pescado', nombre: 'Pescado', emoji: '🐟', grupo: 'proteinas', claves: ['pescado', 'merluza', 'reineta', 'tilapia', 'corvina', 'bacalao', 'salmon', 'trucha', 'congrio'] },
  { id: 'atun', nombre: 'Atún', emoji: '🥫', grupo: 'proteinas', popular: true, claves: ['atun'] },
  { id: 'camaron', nombre: 'Camarones', emoji: '🦐', grupo: 'proteinas', claves: ['camaron', 'gamba', 'langostino'] },
  { id: 'mariscos', nombre: 'Mariscos', emoji: '🦪', grupo: 'proteinas', claves: ['marisco', 'chorito', 'mejillon', 'almeja', 'calamar', 'pulpo', 'macha', 'ostion'] },
  { id: 'tofu', nombre: 'Tofu', emoji: '⬜', grupo: 'proteinas', claves: ['tofu'] },
  { id: 'papa', nombre: 'Papa', emoji: '🥔', grupo: 'verduras', popular: true, claves: ['papa', 'patata'] },
  { id: 'tomate', nombre: 'Tomate', emoji: '🍅', grupo: 'verduras', popular: true, claves: ['tomate', 'jitomate'] },
  { id: 'cebolla', nombre: 'Cebolla', emoji: '🧅', grupo: 'verduras', popular: true, claves: ['cebolla', 'cebolla morada', 'cebolla blanca'] },
  { id: 'cebollin', nombre: 'Cebollín', emoji: '🌿', grupo: 'verduras', claves: ['cebollin', 'cebolleta', 'cebollino', 'ciboulette', 'cebolla de verdeo', 'cebolla larga'] },
  { id: 'ajo', nombre: 'Ajo', emoji: '🧄', grupo: 'verduras', popular: true, claves: ['ajo', 'diente de ajo'] },
  { id: 'zanahoria', nombre: 'Zanahoria', emoji: '🥕', grupo: 'verduras', popular: true, claves: ['zanahoria'] },
  { id: 'palta', nombre: 'Palta', emoji: '🥑', grupo: 'verduras', popular: true, claves: ['palta', 'aguacate'] },
  { id: 'choclo', nombre: 'Choclo', emoji: '🌽', grupo: 'verduras', claves: ['choclo', 'elote', 'maiz', 'mazorca'] },
  { id: 'pimenton', nombre: 'Pimentón', emoji: '🫑', grupo: 'verduras', claves: ['pimenton', 'pimiento', 'morron', 'aji pimenton'] },
  { id: 'aji', nombre: 'Ají', emoji: '🌶️', grupo: 'verduras', claves: ['aji', 'chile', 'jalapeno', 'rocoto', 'chipotle'] },
  { id: 'brocoli', nombre: 'Brócoli', emoji: '🥦', grupo: 'verduras', claves: ['brocoli', 'brecol'] },
  { id: 'coliflor', nombre: 'Coliflor', emoji: '🥬', grupo: 'verduras', claves: ['coliflor'] },
  { id: 'espinaca', nombre: 'Espinaca', emoji: '🥬', grupo: 'verduras', claves: ['espinaca', 'acelga'] },
  { id: 'lechuga', nombre: 'Lechuga', emoji: '🥬', grupo: 'verduras', claves: ['lechuga', 'rucula', 'mix de hojas'] },
  { id: 'repollo', nombre: 'Repollo', emoji: '🥬', grupo: 'verduras', claves: ['repollo', 'col', 'repollo morado'] },
  { id: 'pepino', nombre: 'Pepino', emoji: '🥒', grupo: 'verduras', claves: ['pepino'] },
  { id: 'zapallo', nombre: 'Zapallo', emoji: '🎃', grupo: 'verduras', claves: ['zapallo', 'calabaza', 'auyama', 'ahuyama'] },
  { id: 'zapallo-italiano', nombre: 'Zapallo italiano', emoji: '🥒', grupo: 'verduras', claves: ['zapallo italiano', 'zapallito', 'calabacin', 'zucchini', 'calabacita'] },
  { id: 'berenjena', nombre: 'Berenjena', emoji: '🍆', grupo: 'verduras', claves: ['berenjena'] },
  { id: 'champinon', nombre: 'Champiñones', emoji: '🍄', grupo: 'verduras', popular: true, claves: ['champinon', 'hongo', 'seta'] },
  { id: 'apio', nombre: 'Apio', emoji: '🥬', grupo: 'verduras', claves: ['apio'] },
  { id: 'betarraga', nombre: 'Betarraga', emoji: '🫜', grupo: 'verduras', claves: ['betarraga', 'remolacha', 'betabel'] },
  { id: 'arvejas', nombre: 'Arvejas', emoji: '🫛', grupo: 'verduras', claves: ['arveja', 'guisante', 'chicharo'] },
  { id: 'poroto-verde', nombre: 'Porotos verdes', emoji: '🫛', grupo: 'verduras', claves: ['poroto verde', 'judia verde', 'ejote', 'vainita', 'chaucha'] },
  { id: 'camote', nombre: 'Camote', emoji: '🍠', grupo: 'verduras', claves: ['camote', 'batata', 'boniato'] },
  { id: 'yuca', nombre: 'Yuca', emoji: '🥔', grupo: 'verduras', claves: ['yuca', 'mandioca'] },
  { id: 'cilantro', nombre: 'Cilantro', emoji: '🌿', grupo: 'verduras', claves: ['cilantro', 'culantro'] },
  { id: 'perejil', nombre: 'Perejil', emoji: '🌿', grupo: 'verduras', claves: ['perejil'] },
  { id: 'albahaca', nombre: 'Albahaca', emoji: '🌿', grupo: 'verduras', claves: ['albahaca'] },
  { id: 'jengibre', nombre: 'Jengibre', emoji: '🫚', grupo: 'verduras', claves: ['jengibre', 'kion'] },
  { id: 'platano', nombre: 'Plátano', emoji: '🍌', grupo: 'frutas', popular: true, claves: ['platano', 'banana', 'banano', 'guineo'] },
  { id: 'manzana', nombre: 'Manzana', emoji: '🍎', grupo: 'frutas', claves: ['manzana'] },
  { id: 'limon', nombre: 'Limón', emoji: '🍋', grupo: 'frutas', popular: true, claves: ['limon', 'lima'] },
  { id: 'naranja', nombre: 'Naranja', emoji: '🍊', grupo: 'frutas', claves: ['naranja', 'mandarina'] },
  { id: 'frutilla', nombre: 'Frutillas', emoji: '🍓', grupo: 'frutas', claves: ['frutilla', 'fresa'] },
  { id: 'arandanos', nombre: 'Berries', emoji: '🫐', grupo: 'frutas', claves: ['arandano', 'berrie', 'frambuesa', 'mora'] },
  { id: 'pina', nombre: 'Piña', emoji: '🍍', grupo: 'frutas', claves: ['pina', 'anana'] },
  { id: 'mango', nombre: 'Mango', emoji: '🥭', grupo: 'frutas', claves: ['mango'] },
  { id: 'durazno', nombre: 'Durazno', emoji: '🍑', grupo: 'frutas', claves: ['durazno', 'melocoton'] },
  { id: 'coco', nombre: 'Coco', emoji: '🥥', grupo: 'frutas', claves: ['coco'] },
  { id: 'queso', nombre: 'Queso', emoji: '🧀', grupo: 'lacteos', popular: true, claves: ['queso', 'mozzarella', 'parmesano', 'ricota', 'provoleta', 'quesillo'] },
  { id: 'leche', nombre: 'Leche', emoji: '🥛', grupo: 'lacteos', claves: ['leche'] },
  { id: 'crema', nombre: 'Crema', emoji: '🥛', grupo: 'lacteos', claves: ['crema de leche', 'crema', 'nata', 'crema para batir'] },
  { id: 'yogur', nombre: 'Yogur', emoji: '🥣', grupo: 'lacteos', claves: ['yogur', 'yogurt'] },
  { id: 'mantequilla', nombre: 'Mantequilla', emoji: '🧈', grupo: 'lacteos', claves: ['mantequilla', 'manteca'] },
  { id: 'pasta', nombre: 'Pasta', emoji: '🍝', grupo: 'despensa', popular: true, claves: ['pasta', 'fideo', 'espagueti', 'spaghetti', 'tallarin', 'macarron', 'penne', 'lasana'] },
  { id: 'arroz', nombre: 'Arroz', emoji: '🍚', grupo: 'despensa', popular: true, claves: ['arroz'] },
  { id: 'porotos', nombre: 'Porotos', emoji: '🫘', grupo: 'despensa', popular: true, claves: ['poroto', 'frijol', 'alubia', 'judia', 'caraota'] },
  { id: 'lentejas', nombre: 'Lentejas', emoji: '🫘', grupo: 'despensa', claves: ['lenteja'] },
  { id: 'garbanzos', nombre: 'Garbanzos', emoji: '🫘', grupo: 'despensa', claves: ['garbanzo'] },
  { id: 'quinoa', nombre: 'Quínoa', emoji: '🌾', grupo: 'despensa', claves: ['quinoa', 'quinua'] },
  { id: 'avena', nombre: 'Avena', emoji: '🥣', grupo: 'despensa', claves: ['avena'] },
  { id: 'harina', nombre: 'Harina', emoji: '🌾', grupo: 'despensa', claves: ['harina', 'maicena'] },
  { id: 'pan', nombre: 'Pan', emoji: '🍞', grupo: 'despensa', claves: ['pan', 'marraqueta', 'hallulla', 'pan de molde'] },
  { id: 'tortilla', nombre: 'Tortillas', emoji: '🫓', grupo: 'despensa', claves: ['tortilla de harina', 'tortilla de maiz', 'tortillas'] },
  { id: 'frutos-secos', nombre: 'Frutos secos', emoji: '🥜', grupo: 'despensa', claves: ['nuez', 'nueces', 'almendra', 'mani', 'cacahuate', 'avellana', 'pistacho'] },
  { id: 'aceitunas', nombre: 'Aceitunas', emoji: '🫒', grupo: 'despensa', claves: ['aceituna'] },
  { id: 'miel', nombre: 'Miel', emoji: '🍯', grupo: 'despensa', claves: ['miel'] },
  { id: 'chocolate', nombre: 'Chocolate', emoji: '🍫', grupo: 'despensa', popular: true, claves: ['chocolate', 'cacao'] },
];

export const CATEGORIAS: Categoria[] = [
  {
    id: 'ing',
    nombre: 'Ingredientes',
    titulo: 'Filtrar por ingredientes',
    emoji: '🥕',
    fondo: '#DCEFC6',
    buscar: '¿Qué tienes en casa?',
    opciones: INGREDIENTES,
  },
  {
    id: 'tipo',
    nombre: 'Tipo de comida',
    titulo: 'Filtrar por tipo de comida',
    emoji: '🍽️',
    fondo: '#DCE8FF',
    buscar: 'Buscar',
    opciones: [
      { id: 'desayuno', nombre: 'Desayuno', emoji: '🥞' },
      { id: 'almuerzo', nombre: 'Almuerzo', emoji: '🍛' },
      { id: 'once', nombre: 'Once o merienda', emoji: '☕' },
      { id: 'cena', nombre: 'Cena', emoji: '🌙' },
      { id: 'entrada', nombre: 'Entrada o picoteo', emoji: '🥟' },
      { id: 'acompanamiento', nombre: 'Acompañamiento', emoji: '🥗' },
      { id: 'snack', nombre: 'Snack', emoji: '🍿' },
      { id: 'postre', nombre: 'Postre', emoji: '🍰' },
      { id: 'pan', nombre: 'Panes y masas', emoji: '🥖' },
      { id: 'bebida', nombre: 'Bebida', emoji: '🥤' },
      { id: 'salsa', nombre: 'Salsas y aliños', emoji: '🫙' },
    ],
  },
  {
    id: 'dieta',
    nombre: 'Dieta',
    titulo: 'Filtrar por dieta',
    emoji: '🌱',
    fondo: '#FCE1EA',
    buscar: 'Buscar',
    opciones: [
      { id: 'vegetariana', nombre: 'Vegetariana', emoji: '🥦' },
      { id: 'vegana', nombre: 'Vegana', emoji: '🌱' },
      { id: 'pescetariana', nombre: 'Pescetariana', emoji: '🐟' },
      { id: 'sin-gluten', nombre: 'Sin gluten', emoji: '🌾' },
      { id: 'sin-lactosa', nombre: 'Sin lactosa', emoji: '🥛' },
      { id: 'baja-carbohidratos', nombre: 'Baja en carbohidratos', emoji: '🍞' },
      { id: 'alta-proteina', nombre: 'Alta en proteína', emoji: '💪' },
      { id: 'liviana', nombre: 'Liviana', emoji: '🥗' },
    ],
  },
  {
    id: 'cocina',
    nombre: 'Cocina',
    titulo: 'Filtrar por cocina',
    emoji: '🌎',
    fondo: '#E8DCF7',
    buscar: 'Buscar',
    opciones: [
      { id: 'chilena', nombre: 'Chilena', emoji: '🇨🇱' },
      { id: 'peruana', nombre: 'Peruana', emoji: '🇵🇪' },
      { id: 'mexicana', nombre: 'Mexicana', emoji: '🇲🇽' },
      { id: 'argentina', nombre: 'Argentina', emoji: '🇦🇷' },
      { id: 'colombiana', nombre: 'Colombiana', emoji: '🇨🇴' },
      { id: 'venezolana', nombre: 'Venezolana', emoji: '🇻🇪' },
      { id: 'latinoamericana', nombre: 'Latinoamericana', emoji: '🌎' },
      { id: 'espanola', nombre: 'Española', emoji: '🇪🇸' },
      { id: 'italiana', nombre: 'Italiana', emoji: '🇮🇹' },
      { id: 'francesa', nombre: 'Francesa', emoji: '🇫🇷' },
      { id: 'estadounidense', nombre: 'Estadounidense', emoji: '🇺🇸' },
      { id: 'asiatica', nombre: 'Asiática', emoji: '🥢' },
      { id: 'arabe', nombre: 'Árabe', emoji: '🧆' },
    ],
  },
  {
    id: 'ocasion',
    nombre: 'Ocasión',
    titulo: 'Filtrar por ocasión',
    emoji: '🎉',
    fondo: '#FFE7A8',
    buscar: 'Buscar',
    opciones: [
      { id: 'entre-semana', nombre: 'Cena entre semana', emoji: '📅' },
      { id: 'meal-prep', nombre: 'Para dejar listo', emoji: '🍱' },
      { id: 'compartir', nombre: 'Para compartir', emoji: '🍕' },
      { id: 'ninos', nombre: 'Para niños', emoji: '👶' },
      { id: 'romantica', nombre: 'Cena romántica', emoji: '🕯️' },
      { id: 'reconfortante', nombre: 'Comida reconfortante', emoji: '🍲' },
      { id: 'fiestas', nombre: 'Fiestas y celebraciones', emoji: '🎊' },
      { id: 'economica', nombre: 'Con poco presupuesto', emoji: '💸' },
    ],
  },
  {
    id: 'metodo',
    nombre: 'Método',
    titulo: 'Filtrar por método',
    emoji: '🔥',
    fondo: '#FFD3C2',
    buscar: 'Buscar',
    opciones: [
      { id: 'freidora-de-aire', nombre: 'Freidora de aire', emoji: '💨' },
      { id: 'horno', nombre: 'Al horno', emoji: '🥧' },
      { id: 'sarten', nombre: 'En sartén', emoji: '🍳' },
      { id: 'una-olla', nombre: 'Todo en una olla', emoji: '🍲' },
      { id: 'olla-a-presion', nombre: 'Olla a presión', emoji: '♨️' },
      { id: 'olla-lenta', nombre: 'Olla lenta', emoji: '🫕' },
      { id: 'parrilla', nombre: 'Parrilla', emoji: '🔥' },
      { id: 'microondas', nombre: 'Microondas', emoji: '📦' },
      { id: 'sin-coccion', nombre: 'Sin cocción', emoji: '🥗' },
    ],
  },
];

export function categoria(id: CategoriaFiltro): Categoria {
  return CATEGORIAS.find((c) => c.id === id)!;
}

/** "tipo:cena" → { categoria: 'tipo', opcion: 'cena' }. */
export function partir(filtro: string): { categoria: CategoriaFiltro; opcion: string } {
  const [c, ...resto] = filtro.split(':');
  return { categoria: c as CategoriaFiltro, opcion: resto.join(':') };
}

export function opcionDe(filtro: string): OpcionFiltro | undefined {
  const { categoria: c, opcion } = partir(filtro);
  return CATEGORIAS.find((x) => x.id === c)?.opciones.find((o) => o.id === opcion);
}

/** Filtros agrupados por categoria, como los pide `descubrir_buscar`. */
export function agrupar(filtros: string[]): string[][] {
  const grupos = new Map<string, string[]>();
  for (const f of filtros) {
    const c = partir(f).categoria;
    grupos.set(c, [...(grupos.get(c) ?? []), f]);
  }
  return [...grupos.values()];
}

/** Minusculas y sin tildes, para comparar textos en espanol. */
export function sinTildes(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const PATRONES = INGREDIENTES.map((i) => ({
  id: i.id,
  // Palabra completa, con plural opcional: "papa" no calza con "papaya"
  re: new RegExp(`(^|[^a-z])(${i.claves.map((c) => c.replace(/ /g, '\\s+')).join('|')})(s|es)?([^a-z]|$)`),
}));

/** Ids de ingredientes del filtro que aparecen en los textos de una receta. */
export function ingredientesDe(textos: string[]): string[] {
  const todo = sinTildes(textos.join(' \n '));
  return PATRONES.filter((p) => p.re.test(todo)).map((p) => p.id);
}
