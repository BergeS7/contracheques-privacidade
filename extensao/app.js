(() => {
  "use strict";

  const pdfFile = document.getElementById("pdfFile");
  const processBtn = document.getElementById("processBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const statusEl = document.getElementById("status");
  const resultCard = document.getElementById("resultCard");
  const resultBody = document.getElementById("resultBody");
  const summary = document.getElementById("summary");

  let generatedBlob = null;
  let generatedFilename = "";

  if (!window.pdfjsLib) {
    setStatus("Erro: libs/pdf.min.js não foi carregado.", "error");
    processBtn.disabled = true;
    return;
  }

  if (!window.PDFLib) {
    setStatus("Erro: libs/pdf-lib.min.js não foi carregado.", "error");
    processBtn.disabled = true;
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = "libs/pdf.worker.min.js";

  processBtn.addEventListener("click", processPdf);
  downloadBtn.addEventListener("click", downloadGeneratedPdf);

  pdfFile.addEventListener("change", () => {
    generatedBlob = null;
    generatedFilename = "";
    resultCard.classList.add("hidden");
    downloadBtn.classList.add("hidden");

    if (pdfFile.files?.[0]) {
      setStatus(`Arquivo selecionado: ${pdfFile.files[0].name}`, "info");
    } else {
      setStatus("Selecione um arquivo PDF.", "info");
    }
  });

  function setStatus(message, type = "info") {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  // Remove acentos somente para comparação/ordenação.
  // O nome exibido permanece o original extraído do PDF.
  function normalizeForSort(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleUpperCase("pt-BR");
  }

  function normalizeSpaces(text) {
    return String(text || "")
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getPageText(items) {
    // PDF.js pode retornar itens separados em posições diferentes.
    // Inserimos quebras quando hasEOL estiver marcado e espaço nos demais casos.
    let out = "";
    for (const item of items) {
      out += item.str || "";
      out += item.hasEOL ? "\n" : " ";
    }
    return normalizeSpaces(out);
  }

  function cleanName(raw) {
    return normalizeSpaces(raw)
      .replace(/\s*\n\s*/g, " ")
      .replace(/[,:;.\-\s]+$/g, "")
      .trim();
  }

  // Nome plausível: pelo menos 2 palavras com letras.
  function isPlausibleName(name) {
    return name.split(/\s+/).filter(w => /\p{L}{2,}/u.test(w)).length >= 2;
  }

  /*
    Candidatos a nome, em ordem de confiança:
    1. código de 6 dígitos - NOME   (ex.: 000578 - MARIA DA SILVA)
    2. campo rotulado               (ex.: Nome: Maria da Silva, Funcionário: ..., Colaborador: ...)
    Cada ocorrência vira um candidato; a escolha acontece depois, olhando o documento inteiro.
  */
  function extractCandidates(text) {
    const flat = text.replace(/\n/g, " \n ");
    const candidates = [];
    let match;

    const codeRegex = /(\d{6})\s*-\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'´`.^~Ç\s.-]{2,}?)(?=\s+(?:\n|CPF\b|C\.?P\.?F\.?\b|Admiss[aã]o\b|Cargo\b|Fun[cç][aã]o\b|Depto\b|Departamento\b|Banco\b|Ag[eê]ncia\b|Sal[aá]rio\b|CBO\b|PIS\b|Data\b|Folha\b|\d{4,}\s*-|\p{Lu}\p{Ll}|\S*:)|$)/gu;
    while ((match = codeRegex.exec(flat)) !== null) {
      const name = cleanName(match[2]);
      // Departamentos costumam ter outro " - " no nome (ex.: 000034 - ZD - CONSORCIO).
      if (!name || name.includes(" - ") || !isPlausibleName(name)) continue;
      candidates.push({ code: match[1], name, source: "code", position: match.index });
    }

    const labelRegex = /(?:^|\n|\s)(?:Nome(?:\s+do\s+(?:funcion[aá]rio|colaborador|empregado|servidor|cliente|aluno|paciente))?|Funcion[aá]rio|Colaborador|Empregado|Servidor|Cliente|Aluno|Paciente|Benefici[aá]rio|Favorecido)\s*:\s*([\p{L}][\p{L}'´`.\s]{3,80}?)(?=\s{2,}|\s*\n|\s+(?:CPF|Matr[ií]cula|Cargo|Fun[cç][aã]o|Data|Admiss[aã]o|RG|C[oó]digo)\b|$)/giu;
    while ((match = labelRegex.exec(flat)) !== null) {
      const name = cleanName(match[1]);
      if (!name || !isPlausibleName(name)) continue;
      candidates.push({ code: null, name, source: "label", position: match.index });
    }

    return candidates;
  }

  // Primeira linha com texto de verdade: último recurso para PDFs sem nome identificável.
  function firstTextLine(text) {
    for (const line of text.split("\n")) {
      const clean = line.trim();
      if ((clean.match(/\p{L}/gu) || []).length >= 3) return clean.slice(0, 80);
    }
    return "";
  }

  const keyOf = c => `${c.code || ""}|${normalizeForSort(c.name)}`;

  /*
    Escolhe o nome de um trecho (página inteira ou metade) olhando o documento inteiro:
    - um candidato presente na maioria das páginas é cabeçalho (empresa, departamento) e é ignorado;
    - entre os restantes, vence o que mais se repete no trecho; no empate, o que aparece em menos
      páginas do documento (nomes de pessoas são únicos; cargos e departamentos se repetem);
      por fim, o primeiro no texto.
  */
  function makeChooser(pages) {
    const docFreq = new Map();
    for (const page of pages) {
      for (const key of new Set(page.candidates.map(keyOf))) {
        docFreq.set(key, (docFreq.get(key) || 0) + 1);
      }
    }
    const total = pages.length;
    const isHeader = key => total >= 3 && docFreq.get(key) / total > 0.5;
    const sourceRank = { code: 0, label: 1 };

    return (candidates, text) => {
      if (!text) return { source: "empty", code: null, name: null };

      const counts = new Map();
      for (const c of candidates) {
        const key = keyOf(c);
        const prev = counts.get(key);
        if (prev) prev.count += 1;
        else counts.set(key, { ...c, key, count: 1 });
      }

      let options = [...counts.values()];
      const nonHeader = options.filter(o => !isHeader(o.key));
      if (nonHeader.length) options = nonHeader;

      if (!options.length) return { source: "line", code: null, name: firstTextLine(text) };

      options.sort((x, y) =>
        sourceRank[x.source] - sourceRank[y.source] ||
        y.count - x.count ||
        (docFreq.get(x.key) || 0) - (docFreq.get(y.key) || 0) ||
        x.position - y.position
      );
      const best = options[0];
      return { source: best.source, code: best.code, name: best.name };
    };
  }

  const hasName = choice => choice.source === "code" || choice.source === "label";

  /*
    Transforma cada página em "unidades" a ordenar. Muitos PDFs de contracheque trazem duas
    pessoas por folha (metade de cima e de baixo): nesse caso cada metade vira uma unidade.
    - pessoas diferentes em cima e embaixo → duas metades;
    - a mesma pessoa nas duas metades (duas vias) → folha inteira;
    - só uma metade com conteúdo → só essa metade;
    - qualquer outro caso → folha inteira.
  */
  function buildUnits(pages) {
    const choose = makeChooser(pages);
    const units = [];

    for (const page of pages) {
      const top = choose(page.top.candidates, page.top.text);
      const bottom = choose(page.bottom.candidates, page.bottom.text);

      const half = (part, choice) => ({
        pageNumber: page.pageNumber, part, split: page.split, extent: page[part].extent, ...choice
      });

      if (page.split === null) {
        // Sem faixa em branco entre os contracheques: separar cortaria um deles ao meio.
        units.push({ pageNumber: page.pageNumber, part: "whole", ...choose(page.candidates, page.text) });
      } else if (hasName(top) && hasName(bottom) && keyOf(top) !== keyOf(bottom)) {
        units.push(half("top", top), half("bottom", bottom));
      } else if (hasName(top) && !page.bottom.text) {
        units.push(half("top", top));
      } else if (hasName(bottom) && !page.top.text) {
        units.push(half("bottom", bottom));
      } else {
        units.push({ pageNumber: page.pageNumber, part: "whole", ...choose(page.candidates, page.text) });
      }
    }
    return units;
  }

  // Altura ocupada por um trecho de texto (origem embaixo): da linha de base até o topo das letras,
  // com uma folga para as descendentes (g, p, q).
  function itemSpan(item) {
    const y = item.transform[5];
    const h = Math.abs(item.height || item.transform[3] || 10);
    return [y - 0.3 * h, y + h];
  }

  /*
    Onde separar uma folha com dois contracheques, sem nunca cortar um deles ao meio:
    1. Dois contracheques na mesma folha repetem o mesmo cabeçalho e rótulos (empresa, "Cargo:",
       "Vencimentos"…) exatamente duas vezes, sempre à mesma distância vertical. Essa distância é
       o "passo" entre eles; exige pelo menos 3 textos repetidos concordando.
    2. O segundo contracheque começa um passo abaixo do topo do primeiro.
    3. O corte vai no meio da faixa sem texto que encosta nesse início (mínimo de MIN_GAP pontos).
    Se qualquer passo falhar, devolve null e a folha não é separada.
  */
  const MIN_GAP = 10;
  function findSplit(inkItems, y0, y1) {
    const height = y1 - y0;

    const positions = new Map();
    for (const item of inkItems) {
      const text = item.str.trim();
      if (text.length < 4) continue;
      if (!positions.has(text)) positions.set(text, []);
      positions.get(text).push(item.transform[5]);
    }
    const votes = new Map();
    for (const ys of positions.values()) {
      if (ys.length !== 2) continue;
      const step = Math.round(Math.abs(ys[0] - ys[1]));
      if (step >= 0.25 * height) votes.set(step, (votes.get(step) || 0) + 1);
    }
    let step = null;
    let support = 0;
    for (const s of votes.keys()) {
      const v = (votes.get(s - 1) || 0) + votes.get(s) + (votes.get(s + 1) || 0);
      if (v > support) { support = v; step = s; }
    }
    if (step === null || support < 3) return null;

    const spans = inkItems.map(itemSpan).sort((a, b) => a[0] - b[0]);
    const secondStarts = Math.max(...spans.map(s => s[1])) - step;

    let cursorHigh = null; // topo do bloco de texto contínuo atual (subindo a página)
    const merged = [];
    for (const [lo, hi] of spans) {
      if (cursorHigh !== null && lo <= cursorHigh) {
        cursorHigh = Math.max(cursorHigh, hi);
        merged[merged.length - 1][1] = cursorHigh;
      } else {
        merged.push([lo, hi]);
        cursorHigh = hi;
      }
    }
    for (let i = 0; i + 1 < merged.length; i++) {
      const gapLow = merged[i][1];
      const gapHigh = merged[i + 1][0];
      const center = (gapLow + gapHigh) / 2;
      if (gapHigh - gapLow >= MIN_GAP &&
          secondStarts >= gapLow - 4 && secondStarts <= gapHigh + 4 &&
          center > y0 + 0.25 * height && center < y0 + 0.75 * height) {
        return center;
      }
    }
    return null;
  }

  function extentOf(spans) {
    if (!spans.length) return null;
    return [Math.min(...spans.map(s => s[0])), Math.max(...spans.map(s => s[1]))];
  }

  async function readPdf(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Cópia para o PDF.js: ele transfere o buffer ao worker e o original ficaria vazio para o pdf-lib.
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(`Lendo página ${pageNumber} de ${pdf.numPages}...`, "info");
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const [, y0, , y1] = page.view;
      // Só trechos com letras contam para achar a faixa em branco; os vazios são mantidos no texto
      // porque é neles que o PDF.js marca as quebras de linha.
      const hasInk = item => (item.str || "").trim() !== "";
      const split = findSplit(items.filter(hasInk), y0, y1);

      // transform[5] é a altura da linha de base (origem embaixo): acima do corte = metade de cima.
      const text = getPageText(items);
      const topItems = split === null ? [] : items.filter(item => item.transform[5] > split);
      const bottomItems = split === null ? [] : items.filter(item => item.transform[5] <= split);
      const topText = getPageText(topItems);
      const bottomText = getPageText(bottomItems);
      const extent = list => extentOf(list.filter(hasInk).map(itemSpan));
      pages.push({
        pageNumber,
        text,
        split,
        candidates: extractCandidates(text),
        top: { text: topText, candidates: extractCandidates(topText), extent: extent(topItems) },
        bottom: { text: bottomText, candidates: extractCandidates(bottomText), extent: extent(bottomItems) }
      });
    }

    return { bytes, numPages: pdf.numPages, units: buildUnits(pages) };
  }

  // Agrupa as unidades com o mesmo nome e ordena de A a Z. Unidades sem texto vão para o fim,
  // na ordem original. Dentro de cada grupo, a ordem original é mantida.
  function buildGroups(units) {
    const groups = new Map();
    const empty = [];

    for (const unit of units) {
      if (unit.source === "empty" || !unit.name) {
        empty.push(unit);
        continue;
      }
      const key = keyOf(unit);
      if (!groups.has(key)) {
        groups.set(key, { code: unit.code, name: unit.name, source: unit.source, units: [] });
      }
      groups.get(key).units.push(unit);
    }

    const sorted = [...groups.values()].sort((a, b) =>
      normalizeForSort(a.name).localeCompare(normalizeForSort(b.name), "pt-BR", { sensitivity: "base", numeric: true }) ||
      a.units[0].pageNumber - b.units[0].pageNumber
    );

    if (empty.length) {
      sorted.push({ code: null, name: null, source: "empty", units: empty });
    }
    return sorted;
  }

  const PART_LABEL = { whole: "", top: " (cima)", bottom: " (baixo)" };
  const unitLabel = u => `${u.pageNumber}${PART_LABEL[u.part]}`;

  const SOURCE_LABEL = {
    code: ["ok", "Código e nome"],
    label: ["ok", "Campo de nome"],
    line: ["warn", "1ª linha da página"],
    empty: ["warn", "Sem texto · no final"]
  };

  function renderResults(groups, numPages) {
    resultBody.innerHTML = "";

    groups.forEach((group, index) => {
      const [state, label] = SOURCE_LABEL[group.source];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td>${group.code ? escapeHtml(group.code) : "—"}</td>
        <td>${group.name ? escapeHtml(group.name) : "<em>Página(s) sem texto (imagem)</em>"}</td>
        <td>${group.units.map(unitLabel).join(", ")}</td>
        <td><span class="badge ${state}">${label}</span></td>
      `;
      resultBody.appendChild(tr);
    });

    const named = groups.filter(g => g.source !== "empty").length;
    const halves = groups.flatMap(g => g.units).filter(u => u.part !== "whole").length;
    summary.textContent =
      `${named} nome(s) • ${numPages} página(s) no original` +
      (halves ? ` • ${halves} contracheque(s) separados de folhas com duas pessoas` : "");
    resultCard.classList.remove("hidden");
  }

  // Cada parte com conteúdo (folha inteira ou metade) entra exatamente uma vez.
  function validateOutputOrder(order, totalPages) {
    const seen = new Set();
    for (const unit of order) {
      const parts = unit.part === "whole" ? ["top", "bottom"] : [unit.part];
      for (const part of parts) {
        const id = `${unit.pageNumber}:${part}`;
        if (seen.has(id)) throw new Error(`Falha de integridade: a página ${unit.pageNumber} entrou duas vezes.`);
        seen.add(id);
      }
    }
    for (let page = 1; page <= totalPages; page++) {
      if (!seen.has(`${page}:top`) && !seen.has(`${page}:bottom`)) {
        throw new Error(`Falha de integridade: a página ${page} não entrou no PDF final.`);
      }
    }
  }

  async function buildPdf(originalBytes, order) {
    const srcDoc = await PDFLib.PDFDocument.load(originalBytes, { updateMetadata: false });
    const outDoc = await PDFLib.PDFDocument.create();
    const { PDFName, PDFArray, PDFRef, decodePDFRawStream,
            pushGraphicsState, popGraphicsState, concatTransformationMatrix, drawObject } = PDFLib;
    let pending = null; // metade de cima esperando a de baixo para completar a folha

    function contentBytes(page) {
      const contents = page.node.Contents();
      const streams = contents instanceof PDFArray
        ? contents.asArray().map(ref => outDoc.context.lookup(ref))
        : [contents];
      const parts = streams.filter(Boolean).map(stream => decodePDFRawStream(stream).decode());
      const joined = new Uint8Array(parts.reduce((sum, p) => sum + p.length + 1, 0));
      let offset = 0;
      for (const p of parts) { joined.set(p, offset); offset += p.length; joined[offset++] = 0x0a; }
      return joined;
    }

    // Vira um "formulário" vetorial só com a metade pedida: o texto da outra metade é apagado de
    // verdade (não fica escondido no arquivo) e o que sobra continua selecionável.
    function makeHalf(unit, copied) {
      const box = copied.getMediaBox();
      const split = unit.split;
      const [bottom, top] = unit.part === "top" ? [split, box.y + box.height] : [box.y, split];

      const filtered = PdfHalves.removeTextOutside(
        contentBytes(copied),
        unit.part === "top" ? y => y > split : y => y <= split
      );
      const form = outDoc.context.flateStream(filtered, {
        Type: "XObject",
        Subtype: "Form",
        BBox: [box.x, bottom, box.x + box.width, top],
        Resources: copied.node.Resources()
      });
      return { formRef: outDoc.context.register(form), box, bottom, top, extent: unit.extent };
    }

    // A cópia da página inteira (com o conteúdo original, incluindo a outra metade) não pode
    // ficar no arquivo: depois de gerar as metades, ela é apagada.
    function discardPage(copied) {
      const contentsEntry = copied.node.get(PDFName.of("Contents"));
      const contentRefs = contentsEntry instanceof PDFArray ? contentsEntry.asArray() : [contentsEntry];
      for (const ref of contentRefs) if (ref instanceof PDFRef) outDoc.context.delete(ref);
      outDoc.context.delete(copied.ref);
    }

    // Na folha nova, a metade de cima encosta no topo e a de baixo no pé da folha.
    const upperShift = (half, height) => height - (half.top - half.box.y);
    const lowerShift = half => -(half.bottom - half.box.y);

    // Só junta duas metades na mesma folha se os textos não se sobrepuserem (com folga de 4 pt).
    function fitsTogether(upper, lower) {
      if (!upper.extent || !lower.extent) return true;
      const height = upper.box.height;
      const upperLowest = upper.extent[0] - upper.box.y + upperShift(upper, height);
      const lowerHighest = lower.extent[1] - lower.box.y + lowerShift(lower);
      return lower.box.height === height && lower.box.width === upper.box.width && lowerHighest + 4 <= upperLowest;
    }

    function drawHalf(page, half, shift) {
      const name = page.node.newXObject("Metade", half.formRef);
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(1, 0, 0, 1, -half.box.x, shift - half.box.y),
        drawObject(name),
        popGraphicsState()
      );
    }

    function addHalfPage(upper, lower) {
      const { width, height } = upper.box;
      const page = outDoc.addPage([width, height]);
      drawHalf(page, upper, upperShift(upper, height));
      if (lower) drawHalf(page, lower, lowerShift(lower));
    }

    // Uma única cópia de todas as páginas: fontes e imagens compartilhadas entram uma vez só.
    // copyPages copia a folha completa: sem escala, recorte, rotação ou alteração de conteúdo.
    const needed = [...new Set(order.map(u => u.pageNumber))];
    const copies = await outDoc.copyPages(srcDoc, needed.map(n => n - 1));
    const copyOf = new Map(needed.map((n, i) => [n, copies[i]]));
    const splitPages = new Set(order.filter(u => u.part !== "whole").map(u => u.pageNumber));

    for (const unit of order) {
      if (unit.part === "whole") {
        if (pending) addHalfPage(pending, null);
        pending = null;
        outDoc.addPage(copyOf.get(unit.pageNumber));
        continue;
      }

      const half = makeHalf(unit, copyOf.get(unit.pageNumber));
      if (pending && fitsTogether(pending, half)) {
        addHalfPage(pending, half);
        pending = null;
      } else {
        if (pending) addHalfPage(pending, null);
        pending = half;
      }
    }
    if (pending) addHalfPage(pending, null);
    for (const pageNumber of splitPages) discardPage(copyOf.get(pageNumber));

    const pdfBytes = await outDoc.save({
      // objectStreams=false tende a maximizar compatibilidade com leitores antigos.
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false
    });
    return { pdfBytes, pageCount: outDoc.getPageCount() };
  }

  function outputFilename(originalName) {
    return `${originalName.replace(/\.pdf$/i, "")} - ordem alfabetica.pdf`;
  }

  async function processPdf() {
    const file = pdfFile.files?.[0];
    if (!file) {
      setStatus("Selecione um PDF antes de continuar.", "error");
      return;
    }

    processBtn.disabled = true;
    downloadBtn.classList.add("hidden");
    generatedBlob = null;

    try {
      const { bytes, numPages, units } = await readPdf(file);
      const groups = buildGroups(units);
      renderResults(groups, numPages);

      const order = groups.flatMap(g => g.units);
      validateOutputOrder(order, numPages);

      setStatus("Gerando PDF em ordem alfabética...", "info");
      const { pdfBytes, pageCount } = await buildPdf(bytes, order);

      generatedBlob = new Blob([pdfBytes], { type: "application/pdf" });
      generatedFilename = outputFilename(file.name);
      downloadBtn.classList.remove("hidden");

      const empty = groups.find(g => g.source === "empty");
      const extra = empty ? ` ${empty.units.length} página(s) sem texto ficaram no final.` : "";
      setStatus(
        `PDF organizado em ordem alfabética: ${pageCount} página(s). ` +
        `Todo o conteúdo das ${numPages} página(s) originais foi incluído uma única vez.${extra}`,
        "ok"
      );
    } catch (error) {
      console.error(error);
      setStatus(`Erro ao processar o PDF: ${error.message || error}`, "error");
    } finally {
      processBtn.disabled = false;
    }
  }

  function downloadGeneratedPdf() {
    if (!generatedBlob) return;

    const url = URL.createObjectURL(generatedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
})();
