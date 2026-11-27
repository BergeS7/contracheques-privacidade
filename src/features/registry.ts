/**
 * Registro central de ferramentas. Alimenta página inicial, busca, menu, categorias, favoritos,
 * recentes e rotas. Para adicionar uma ferramenta: uma entrada aqui + o componente.
 *
 * `status`:
 *  - "available": implementada e coberta por testes do motor;
 *  - "planned":   no roadmap, ainda não implementada (aparece como "Em breve", sem ação);
 *  - "blocked":   depende de decisão técnica (motivo em `note`).
 */
import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import {
  Combine, Scissors, FileOutput, Trash2, RotateCw, LayoutGrid, ArrowDownUp, Shuffle, Columns2, FilePlus2,
  Scaling, Copy, SortAsc, Image, FileImage, FileText, FileType2, FileCode2, Droplets, Hash, PanelTop,
  ShieldCheck, Eraser, ScanSearch, Users, Search, Files, Lock, Unlock, EyeOff, PenTool, Type, Signature,
  Highlighter, Stamp, Crop, ScanText, FileSpreadsheet, Presentation, Minimize2, GitCompare, Workflow,
  Building2, Receipt, Calendar, FolderTree, FileSearch, Table, type LucideIcon
} from "lucide-react";

export type CategoryId = "organizar" | "converter" | "editar" | "seguranca" | "ocr" | "automacoes";
export type ToolStatus = "available" | "planned" | "blocked";

export interface Category {
  id: CategoryId;
  name: string;
  description: string;
}

export const CATEGORIES: Category[] = [
  { id: "organizar", name: "Organizar", description: "Juntar, dividir, reordenar e ajustar páginas." },
  { id: "converter", name: "Converter", description: "PDF para imagens e texto, e o caminho inverso." },
  { id: "editar", name: "Editar", description: "Marca-d'água, numeração, cabeçalhos e rodapés." },
  { id: "seguranca", name: "Segurança", description: "Metadados, diagnóstico e dados pessoais." },
  { id: "ocr", name: "OCR", description: "Reconhecimento de texto em documentos digitalizados." },
  { id: "automacoes", name: "Automações", description: "Contracheques, buscas e processamento em lote." }
];

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  category: CategoryId;
  icon: LucideIcon;
  /** Tipos aceitos no seletor de arquivos. */
  accept: string;
  multiple: boolean;
  offline: boolean;
  batch: boolean;
  engine: string;
  status: ToolStatus;
  keywords?: string[];
  /** Limitações reais ou motivo de bloqueio. */
  note?: string;
  /** Parâmetros fixos repassados ao componente (variações da mesma ferramenta). */
  preset?: Record<string, string>;
  component?: LazyExoticComponent<ComponentType<ToolComponentProps>>;
  featured?: boolean;
}

export interface ToolComponentProps {
  tool: ToolDef;
}

const PDF = "application/pdf,.pdf";
const IMG = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
const L = (loader: () => Promise<{ default: ComponentType<ToolComponentProps> }>) => lazy(loader);

const Merge = L(() => import("./organize/MergeTool"));
const Split = L(() => import("./organize/SplitTool"));
const Extract = L(() => import("./organize/ExtractTool"));
const Delete = L(() => import("./organize/DeleteTool"));
const Rotate = L(() => import("./organize/RotateTool"));
const Pages = L(() => import("./organize/PagesTool"));
const Simple = L(() => import("./organize/SimpleTools"));
const Resize = L(() => import("./organize/ResizeTool"));
const ImagesToPdf = L(() => import("./convert/ImagesToPdfTool"));
const PdfToImages = L(() => import("./convert/PdfToImagesTool"));
const PdfToText = L(() => import("./convert/PdfToTextTool"));
const TextToPdf = L(() => import("./convert/TextToPdfTool"));
const Watermark = L(() => import("./edit/WatermarkTool"));
const PageNumbers = L(() => import("./edit/PageNumbersTool"));
const HeaderFooter = L(() => import("./edit/HeaderFooterTool"));
const Inspect = L(() => import("./security/InspectTool"));
const RemoveMeta = L(() => import("./security/RemoveMetadataTool"));
const PersonalData = L(() => import("./security/PersonalDataTool"));
const Payroll = L(() => import("./automations/payroll/PayrollTool"));
const SearchDocs = L(() => import("./automations/SearchDocsTool"));
const Duplicates = L(() => import("./automations/DuplicatesTool"));

const base = { offline: true, batch: false, multiple: false, accept: PDF, engine: "pdf-lib" } as const;
const planned = (t: Omit<ToolDef, "status" | "offline" | "batch" | "multiple" | "accept" | "engine"> & Partial<ToolDef>): ToolDef =>
  ({ ...base, engine: "—", status: "planned", ...t });

export const TOOLS: ToolDef[] = [
  // ── Automações (diferencial) ───────────────────────────────────────────────
  { ...base, id: "contracheques", name: "Organizar contracheques", description: "Ordena de A a Z por funcionário, separa folhas com duas pessoas e exporta por funcionário em ZIP.", category: "automacoes", icon: Users, multiple: true, batch: true, engine: "pdf.js + pdf-lib", status: "available", component: Payroll, featured: true, keywords: ["holerite", "folha", "funcionário", "alfabética", "a-z", "recibo"] },
  { ...base, id: "buscar", name: "Buscar em vários PDFs", description: "Procura palavras em muitos documentos de uma vez, sem diferenciar acentos.", category: "automacoes", icon: FileSearch, multiple: true, batch: true, engine: "pdf.js", status: "available", component: SearchDocs, keywords: ["pesquisar", "localizar", "palavra"] },
  { ...base, id: "duplicados", name: "Identificar duplicados", description: "Encontra arquivos idênticos e documentos com o mesmo texto.", category: "automacoes", icon: Files, multiple: true, batch: true, engine: "pdf.js + Web Crypto", status: "available", component: Duplicates, keywords: ["repetidos", "iguais"] },
  planned({ id: "agrupar-cpf", name: "Agrupar por CPF/CNPJ", description: "Separa documentos por CPF, CNPJ ou empresa reconhecidos no texto.", category: "automacoes", icon: Building2 }),
  planned({ id: "recibos", name: "Organizar recibos e notas", description: "Recibos, comprovantes e notas fiscais por data, valor e emitente.", category: "automacoes", icon: Receipt }),
  planned({ id: "agrupar-data", name: "Agrupar por data", description: "Organiza documentos pela data identificada.", category: "automacoes", icon: Calendar }),
  planned({ id: "regras", name: "Regras e fluxos", description: "Regras personalizadas e fluxos reutilizáveis (importar → separar → renomear → ZIP).", category: "automacoes", icon: Workflow }),
  planned({ id: "comparar", name: "Comparar PDFs", description: "Diferenças de texto entre duas versões de um documento.", category: "automacoes", icon: GitCompare }),
  planned({ id: "fichas", name: "Organizar fichas cadastrais", description: "Separação e renomeação de fichas por pessoa.", category: "automacoes", icon: FolderTree }),

  // ── Organizar ──────────────────────────────────────────────────────────────
  { ...base, id: "juntar", name: "Juntar PDF", description: "Combine vários PDFs em um só, na ordem que preferir.", category: "organizar", icon: Combine, multiple: true, batch: true, status: "available", component: Merge, featured: true, keywords: ["unir", "mesclar", "combinar"] },
  { ...base, id: "dividir", name: "Dividir PDF", description: "Separe por intervalos, a cada N páginas ou página por página.", category: "organizar", icon: Scissors, status: "available", component: Split, featured: true, keywords: ["separar", "partes"] },
  { ...base, id: "organizar-paginas", name: "Organizar páginas", description: "Arraste para reordenar, gire, duplique, exclua e insira páginas em branco.", category: "organizar", icon: LayoutGrid, multiple: true, engine: "pdf.js + pdf-lib", status: "available", component: Pages, featured: true, keywords: ["reordenar", "arrastar", "miniaturas", "mover"] },
  { ...base, id: "extrair", name: "Extrair páginas", description: "Crie um PDF só com as páginas escolhidas, ou uma por arquivo.", category: "organizar", icon: FileOutput, status: "available", component: Extract },
  { ...base, id: "excluir", name: "Excluir páginas", description: "Remova páginas indesejadas do documento.", category: "organizar", icon: Trash2, status: "available", component: Delete, keywords: ["remover", "apagar"] },
  { ...base, id: "girar", name: "Girar PDF", description: "Gire todas ou algumas páginas em 90°, 180° ou 270°.", category: "organizar", icon: RotateCw, status: "available", component: Rotate, keywords: ["rotacionar"] },
  { ...base, id: "inverter", name: "Inverter ordem", description: "Coloque a última página primeiro.", category: "organizar", icon: ArrowDownUp, status: "available", component: Simple, preset: { mode: "reverse" } },
  { ...base, id: "intercalar", name: "Intercalar PDFs", description: "Alterne páginas de dois documentos (frente e verso digitalizados).", category: "organizar", icon: Shuffle, multiple: true, status: "available", component: Simple, preset: { mode: "interleave" }, keywords: ["frente", "verso"] },
  { ...base, id: "pares-impares", name: "Separar pares e ímpares", description: "Gere um PDF com as páginas ímpares e outro com as pares.", category: "organizar", icon: Columns2, status: "available", component: Simple, preset: { mode: "oddeven" } },
  { ...base, id: "duplicar", name: "Duplicar páginas", description: "Repita páginas logo após a original.", category: "organizar", icon: Copy, status: "available", component: Simple, preset: { mode: "duplicate" } },
  { ...base, id: "paginas-em-branco", name: "Inserir páginas em branco", description: "No início, no fim, após cada página ou após páginas escolhidas.", category: "organizar", icon: FilePlus2, status: "available", component: Simple, preset: { mode: "blank" } },
  { ...base, id: "tamanho", name: "Alterar tamanho das páginas", description: "Ajuste para A4, Carta, Ofício e outros, sem perder o texto selecionável.", category: "organizar", icon: Scaling, status: "available", component: Resize, keywords: ["a4", "carta", "redimensionar"] },
  { ...base, id: "ordenar-arquivos", name: "Ordenar documentos A-Z", description: "Coloque vários PDFs em ordem alfabética e junte ou renumere em ZIP.", category: "organizar", icon: SortAsc, multiple: true, batch: true, status: "available", component: Simple, preset: { mode: "sortfiles" }, keywords: ["alfabética"] },
  planned({ id: "recortar", name: "Recortar páginas", description: "Recorte margens com remoção real do conteúdo fora da área.", category: "organizar", icon: Crop }),
  planned({ id: "comprimir", name: "Comprimir PDF", description: "Reduz o tamanho recomprimindo imagens.", category: "organizar", icon: Minimize2, note: "Requer recompressão de imagens (avaliando MuPDF/QPDF em WebAssembly)." }),

  // ── Converter ──────────────────────────────────────────────────────────────
  { ...base, id: "jpg-para-pdf", name: "JPG para PDF", description: "Transforme fotos JPG em PDF sem perder qualidade.", category: "converter", icon: Image, accept: IMG, multiple: true, batch: true, status: "available", component: ImagesToPdf, featured: true, preset: { from: "jpg" } },
  { ...base, id: "png-para-pdf", name: "PNG para PDF", description: "Converta imagens PNG em PDF.", category: "converter", icon: Image, accept: IMG, multiple: true, batch: true, status: "available", component: ImagesToPdf, preset: { from: "png" } },
  { ...base, id: "webp-para-pdf", name: "WEBP para PDF", description: "Converta imagens WEBP em PDF.", category: "converter", icon: Image, accept: IMG, multiple: true, batch: true, engine: "Canvas + pdf-lib", status: "available", component: ImagesToPdf, preset: { from: "webp" } },
  { ...base, id: "pdf-para-jpg", name: "PDF para JPG", description: "Cada página vira uma imagem JPG.", category: "converter", icon: FileImage, engine: "pdf.js", status: "available", component: PdfToImages, featured: true, preset: { format: "jpeg" } },
  { ...base, id: "pdf-para-png", name: "PDF para PNG", description: "Cada página vira uma imagem PNG.", category: "converter", icon: FileImage, engine: "pdf.js", status: "available", component: PdfToImages, preset: { format: "png" } },
  { ...base, id: "pdf-para-webp", name: "PDF para WEBP", description: "Cada página vira uma imagem WEBP.", category: "converter", icon: FileImage, engine: "pdf.js", status: "available", component: PdfToImages, preset: { format: "webp" } },
  { ...base, id: "pdf-para-txt", name: "PDF para TXT", description: "Extraia o texto do PDF.", category: "converter", icon: FileText, engine: "pdf.js", multiple: true, batch: true, status: "available", component: PdfToText, preset: { format: "txt" }, note: "PDFs digitalizados (imagem) não têm texto: precisam de OCR." },
  { ...base, id: "pdf-para-markdown", name: "PDF para Markdown", description: "Texto com títulos, listas e parágrafos em Markdown.", category: "converter", icon: FileCode2, engine: "pdf.js", multiple: true, batch: true, status: "available", component: PdfToText, preset: { format: "md" }, note: "Tabelas e imagens não são reconstruídas." },
  { ...base, id: "txt-para-pdf", name: "TXT para PDF", description: "Transforme texto simples em PDF paginado.", category: "converter", icon: FileType2, accept: "text/plain,.txt", status: "available", component: TextToPdf },
  planned({ id: "pdf-para-word", name: "PDF para Word", description: "Conversão para DOCX preservando a formatação.", category: "converter", icon: FileText, note: "Sem motor local confiável no navegador; em avaliação (WebAssembly)." }),
  planned({ id: "word-para-pdf", name: "Word para PDF", description: "DOCX para PDF.", category: "converter", icon: FileText, note: "Exige motor de layout de documentos Office; em avaliação." }),
  planned({ id: "pdf-para-excel", name: "PDF para Excel", description: "Tabelas do PDF para XLSX.", category: "converter", icon: FileSpreadsheet }),
  planned({ id: "excel-para-pdf", name: "Excel para PDF", description: "XLSX para PDF.", category: "converter", icon: FileSpreadsheet }),
  planned({ id: "pdf-para-ppt", name: "PDF para PowerPoint", description: "Páginas para slides.", category: "converter", icon: Presentation }),
  planned({ id: "ppt-para-pdf", name: "PowerPoint para PDF", description: "PPTX para PDF.", category: "converter", icon: Presentation }),
  planned({ id: "html-para-pdf", name: "HTML para PDF", description: "Páginas HTML locais para PDF.", category: "converter", icon: FileCode2 }),

  // ── Editar ─────────────────────────────────────────────────────────────────
  { ...base, id: "marca-dagua", name: "Marca-d'água", description: "Texto sobre as páginas, centralizado ou em mosaico.", category: "editar", icon: Droplets, status: "available", component: Watermark, featured: true, keywords: ["confidencial", "carimbo"] },
  { ...base, id: "numerar", name: "Numerar páginas", description: "Números em qualquer canto, com formato personalizado.", category: "editar", icon: Hash, status: "available", component: PageNumbers, keywords: ["numeração", "paginação"] },
  { ...base, id: "cabecalho-rodape", name: "Cabeçalho e rodapé", description: "Texto no topo e no pé de cada página.", category: "editar", icon: PanelTop, status: "available", component: HeaderFooter },
  planned({ id: "editor", name: "Editor de PDF", description: "Textos, imagens, formas, setas, desenho livre e camadas.", category: "editar", icon: PenTool }),
  planned({ id: "anotar", name: "Anotar e destacar", description: "Destaque, sublinhado, comentários e notas.", category: "editar", icon: Highlighter }),
  planned({ id: "assinar", name: "Assinatura manuscrita", description: "Desenhe ou insira a imagem da assinatura (não é assinatura digital certificada).", category: "editar", icon: Signature }),
  planned({ id: "carimbo", name: "Carimbos personalizados", description: "Carimbos de texto e imagem.", category: "editar", icon: Stamp }),
  planned({ id: "editar-texto", name: "Editar texto existente", description: "Alterar textos já presentes no PDF, quando tecnicamente possível.", category: "editar", icon: Type }),

  // ── Segurança ──────────────────────────────────────────────────────────────
  { ...base, id: "diagnostico", name: "Diagnóstico e metadados", description: "Integridade, criptografia, assinaturas digitais, scripts e metadados.", category: "seguranca", icon: ShieldCheck, multiple: true, batch: true, status: "available", component: Inspect, keywords: ["corrompido", "assinatura", "propriedades", "inspecionar"] },
  { ...base, id: "remover-metadados", name: "Remover metadados", description: "Apaga autor, título, datas, XMP e informações do programa.", category: "seguranca", icon: Eraser, multiple: true, batch: true, status: "available", component: RemoveMeta },
  { ...base, id: "dados-pessoais", name: "Localizar dados pessoais", description: "Encontra CPF, CNPJ, e-mails, telefones, datas e valores, com relatório.", category: "seguranca", icon: ScanSearch, multiple: true, batch: true, engine: "pdf.js", status: "available", component: PersonalData, keywords: ["lgpd", "cpf", "cnpj", "privacidade", "extrair dados"] },
  planned({ id: "proteger", name: "Proteger com senha", description: "Criptografia AES com senha.", category: "seguranca", icon: Lock, note: "pdf-lib não criptografa; avaliando QPDF (WASM, Apache 2.0)." }),
  planned({ id: "desbloquear", name: "Remover senha", description: "Mediante a senha correta e autorização.", category: "seguranca", icon: Unlock }),
  planned({ id: "ocultar", name: "Ocultar informações (tarja)", description: "Remoção permanente do texto e da imagem sob a tarja.", category: "seguranca", icon: EyeOff }),

  // ── OCR ────────────────────────────────────────────────────────────────────
  planned({ id: "ocr", name: "OCR (português e inglês)", description: "Texto de imagens e PDFs digitalizados, 100% local.", category: "ocr", icon: ScanText, note: "Tesseract.js com modelos empacotados (≈ 15 MB)." }),
  planned({ id: "pdf-pesquisavel", name: "PDF pesquisável", description: "Camada de texto invisível sobre digitalizações.", category: "ocr", icon: Search }),
  planned({ id: "tabelas", name: "Extrair tabelas", description: "Tabelas para CSV, com indicação de limitações.", category: "ocr", icon: Table })
];

export const availableTools = TOOLS.filter(t => t.status === "available");
export const toolById = (id: string) => TOOLS.find(t => t.id === id);
export const toolsByCategory = (cat: CategoryId) => TOOLS.filter(t => t.category === cat);

/** Busca por nome, descrição e palavras-chave, sem diferenciar acentos. */
export function searchTools(query: string): ToolDef[] {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const terms = fold(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return TOOLS;
  return TOOLS
    .map(tool => {
      const hay = fold([tool.name, tool.description, ...(tool.keywords ?? []), CATEGORIES.find(c => c.id === tool.category)?.name ?? ""].join(" "));
      const name = fold(tool.name);
      const score = terms.reduce((s, t) => s + (name.includes(t) ? 3 : hay.includes(t) ? 1 : -100), 0);
      return { tool, score: score + (tool.status === "available" ? 0.5 : 0) };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.tool);
}

/** Ferramentas sugeridas para arquivos soltos na página inicial. */
export function suggestTools(files: File[]): ToolDef[] {
  const allPdf = files.every(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  const allImg = files.every(f => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name));
  const ids = allPdf
    ? files.length > 1
      ? ["juntar", "contracheques", "organizar-paginas", "buscar", "ordenar-arquivos", "dados-pessoais"]
      : ["contracheques", "organizar-paginas", "dividir", "pdf-para-jpg", "marca-dagua", "diagnostico"]
    : allImg
      ? ["jpg-para-pdf"]
      : /\.txt$/i.test(files[0]?.name ?? "") ? ["txt-para-pdf"] : [];
  return ids.map(id => toolById(id)!).filter(Boolean);
}
