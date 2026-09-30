// Remove de verdade (não só esconde) o texto que fica fora de uma faixa da página.
// Usado ao separar folhas com duas pessoas: sem isso, a metade "cortada" continuaria dentro
// do PDF, invisível, e poderia vazar ao copiar o texto ou extrair a página.
//
// Lê o fluxo de conteúdo da página (operadores PDF), acompanha a posição de cada bloco de texto
// (BT … ET) e descarta os blocos cuja posição cai fora da faixa pedida. Os ajustes de fonte
// (Tf, Tc, …) dos blocos descartados são mantidos, porque valem para os blocos seguintes.
(function (root) {
  "use strict";

  const WHITESPACE = new Set([0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]);
  const DELIMITERS = new Set([0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]);
  const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;
  const TEXT_STATE_OPS = new Set(["Tf", "Tc", "Tw", "Tz", "TL", "Ts", "Tr"]);

  // Divide o conteúdo em tokens com posição, pulando strings, comentários e imagens embutidas.
  function tokenize(s) {
    const tokens = [];
    let i = 0;
    const n = s.length;

    while (i < n) {
      const c = s.charCodeAt(i);
      if (WHITESPACE.has(c)) { i++; continue; }

      const start = i;
      if (c === 0x25) { // % comentário
        while (i < n && s[i] !== "\n" && s[i] !== "\r") i++;
        continue;
      }
      if (c === 0x28) { // ( string literal, com parênteses aninhados e escapes
        let depth = 0;
        for (; i < n; i++) {
          const ch = s[i];
          if (ch === "\\") { i++; continue; }
          if (ch === "(") depth++;
          else if (ch === ")" && --depth === 0) { i++; break; }
        }
        tokens.push({ kind: "operand", value: null, start, end: i });
        continue;
      }
      if (s.startsWith("<<", i) || s.startsWith(">>", i)) {
        i += 2;
        tokens.push({ kind: "operand", value: null, start, end: i });
        continue;
      }
      if (c === 0x3c) { // <hex>
        const close = s.indexOf(">", i);
        i = close === -1 ? n : close + 1;
        tokens.push({ kind: "operand", value: null, start, end: i });
        continue;
      }
      if (c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
        i++;
        tokens.push({ kind: "operand", value: null, start, end: i });
        continue;
      }
      if (c === 0x2f) { // /Nome
        i++;
        while (i < n && !WHITESPACE.has(s.charCodeAt(i)) && !DELIMITERS.has(s.charCodeAt(i))) i++;
        tokens.push({ kind: "operand", value: s.slice(start, i), start, end: i });
        continue;
      }

      while (i < n && !WHITESPACE.has(s.charCodeAt(i)) && !DELIMITERS.has(s.charCodeAt(i))) i++;
      if (i === start) { i++; continue; } // caractere solto inesperado
      const word = s.slice(start, i);

      if (NUMBER.test(word) || word === "true" || word === "false" || word === "null") {
        tokens.push({ kind: "operand", value: NUMBER.test(word) ? parseFloat(word) : word, start, end: i });
        continue;
      }

      tokens.push({ kind: "op", value: word, start, end: i });

      if (word === "ID") { // imagem embutida: dados binários até "EI"
        const m = /\sEI(?=[\s]|$)/g;
        m.lastIndex = i;
        const found = m.exec(s);
        i = found ? found.index + found[0].length : n;
        tokens.push({ kind: "op", value: "EI", start: found ? found.index + 1 : n, end: i });
      }
    }
    return tokens;
  }

  const multiply = (m, n) => [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
  ];

  // keepY(y) → true para manter um bloco de texto cuja linha de base está na altura y (origem embaixo).
  function removeTextOutside(bytes, keepY) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }

    const tokens = tokenize(s);
    const cuts = []; // [início, fim, substituto]
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack = [];
    let operands = [];
    let block = null;

    for (const t of tokens) {
      if (t.kind === "operand") { operands.push(t); continue; }

      const nums = operands.filter(o => typeof o.value === "number").map(o => o.value);
      const op = t.value;

      if (op === "q") stack.push(ctm);
      else if (op === "Q") ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (op === "cm" && nums.length >= 6) ctm = multiply(nums.slice(-6), ctm);
      else if (op === "BT") {
        block = { start: t.start, tlm: [1, 0, 0, 1, 0, 0], y: null, state: [] };
      } else if (block) {
        if ((op === "Td" || op === "TD") && nums.length >= 2) {
          const [tx, ty] = nums.slice(-2);
          block.tlm = multiply([1, 0, 0, 1, tx, ty], block.tlm);
        } else if (op === "Tm" && nums.length >= 6) {
          block.tlm = nums.slice(-6);
        }
        if ((op === "Td" || op === "TD" || op === "Tm") && block.y === null) {
          const m = multiply(block.tlm, ctm);
          block.y = m[5];
        }
        if (TEXT_STATE_OPS.has(op)) {
          const from = operands.length ? operands[0].start : t.start;
          block.state.push(s.slice(from, t.end));
        }
        if (op === "ET") {
          if (block.y !== null && !keepY(block.y)) {
            cuts.push([block.start, t.end, block.state.join(" ")]);
          }
          block = null;
        }
      }
      operands = [];
    }

    if (!cuts.length) return bytes;
    let out = "";
    let pos = 0;
    for (const [start, end, replacement] of cuts) {
      out += s.slice(pos, start) + replacement;
      pos = end;
    }
    out += s.slice(pos);

    const result = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) result[i] = out.charCodeAt(i) & 0xff;
    return result;
  }

  root.PdfHalves = { removeTextOutside, tokenize };
})(typeof window !== "undefined" ? window : globalThis);
