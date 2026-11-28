// Escalas da Diaconia (antigo app "Escalas Somos Um"), dentro do app de membros.
// Usa as mesmas tabelas que o app antigo já usava neste banco: cultos, voluntarios, avisos, envios ({id, data jsonb, updated_at}).
// Usa do index.html: sb, estado, $, esc, toast, MESES.
const ES_FUNCOES = [
  { k: 'abertura', l: 'Abertura', c: '#b01e1e' }, { k: 'recepcao', l: 'Recepção', c: '#1f7a4d' }, { k: 'apoio_recepcao', l: 'Apoio Recepção', c: '#3d9a6c' },
  { k: 'oferta', l: 'Oferta', c: '#c98a1d' }, { k: 'palco', l: 'Apoio de Palco', c: '#2563a8' }, { k: 'geral', l: 'Apoio Geral', c: '#6b4fa0' },
  { k: 'estac', l: 'Estacionamento', c: '#6a6a6a' }, { k: 'encerramento', l: 'Encerramento', c: '#0f766e' },
  { k: 'leitura', l: 'Leitura do Texto', c: '#a86e14' }, { k: 'oracao', l: 'Oração Elementos', c: '#8b002a' }, { k: 'distribuicao', l: 'Distribuição', c: '#5a2e78' }];
const ES_F = Object.fromEntries(ES_FUNCOES.map((r) => [r.k, r]));
const ES_BASE = ['abertura', 'recepcao', 'oferta', 'palco', 'geral', 'estac', 'encerramento'];
const ES_SEM_SUGESTAO = ['abertura', 'oferta', 'encerramento'];
const ES_VAGAS = { recepcao: 2, apoio_recepcao: 2, estac: 2, distribuicao: 3 };
const ES_DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ES_DK = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const ES_HORA = { 2: '20h', 6: '19h30', 0: '19h' };
const ES_NOTA_CHEGADA = 'Com carinho: pedimos que todos os obreiros e voluntários cheguem com 30 minutos de antecedência. Assim nos preparamos com calma e recebemos bem cada irmão.';
const ES_NOTA_TER = 'Lembrete: ao final do culto, os voluntários empilham as cadeiras para a aula de jiu-jitsu de quinta-feira.';
const ES_ASSIN = 'Diaconia — Ministério Cristão Somos Um';
const ES_AMOR = 'Seu serviço voluntário é feito com amor e faz toda a diferença. Cada irmão é parte do conjunto, e juntos somos a família que acolhe quem chega à casa do Senhor. ❤️';

const es = { novoMembro: null, semAcesso: false, cultos: null, vols: [], avisos: {}, envios: {}, sub: 'inicio', mes: null, busca: '', lembrete: null, verMensal: false, card: null, erro: null };
try { const s = localStorage.getItem('es_sub'); if (s) es.sub = s; } catch (e) { /* sem localStorage */ }

const esNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const esSlug = (s) => esNorm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
const esPd = (s) => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const esYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const esDm = (s) => { const d = esPd(s); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const esDia = (s) => ES_DIAS[esPd(s).getDay()];
const esDk = (s) => ES_DK[esPd(s).getDay()];
const esClone = (o) => JSON.parse(JSON.stringify(o));
const esGrupo = (n) => /^grupo\b/i.test(n);

// ---------- quem é quem (nomes e apelidos) ----------
let ES_IDX = {}, ES_VBY = {};
function esIndexar() { ES_IDX = {}; ES_VBY = {}; for (const v of es.vols) { ES_VBY[v.id] = v; ES_IDX[esNorm(v.nome)] = v.id; (v.apelidos || []).forEach((a) => (ES_IDX[esNorm(a)] = v.id)); } }
const esIdent = (n) => ES_IDX[esNorm(n)] || 'x-' + esSlug(n);
const esVol = (n) => ES_VBY[esIdent(n)] || null;
const esNome = (n) => { const v = esVol(n); return v ? v.nome : n; };
const esOrdenados = () => es.cultos.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
function esPessoas(c) {
  const o = {}; if (!c) return o;
  for (const k of Object.keys(c.assign || {})) { if (!(c.funcoes || []).includes(k)) continue; for (const n of c.assign[k] || []) (o[esIdent(n)] = o[esIdent(n)] || []).push(k); }
  return o;
}
// Telefone do voluntário; se não tiver, usa o do cadastro de membros ligado a ele
function esTelefone(v) {
  if (!v) return '';
  if (telefoneWa(v.telefone)) return v.telefone;
  const m = v.membro_id && estado.membros.find((x) => x.id === v.membro_id);
  return m && telefoneWa(m.telefone) ? m.telefone : '';
}

// ---------- análise: funções vazias e avisos ----------
function esPrimeiroNome(c, ident) { for (const k of Object.keys(c.assign || {})) for (const n of c.assign[k] || []) if (esIdent(n) === ident) return n; return ident; }
function esAnalisar() {
  const l = esOrdenados(), out = {}, cont = {};
  l.forEach((c, i) => {
    const id = esPessoas(c), ant = esPessoas(l[i - 1]), r = { vazias: [], avisos: [] };
    (c.funcoes || []).forEach((k) => { if (!((c.assign || {})[k] || []).length) r.vazias.push(ES_F[k] ? ES_F[k].l : k); });
    for (const ident of Object.keys(id)) {
      cont[ident] = (cont[ident] || 0) + id[ident].length;
      const nm = esNome(esPrimeiroNome(c, ident));
      const fs = [...new Set(id[ident])];
      const av = (key, text) => r.avisos.push({ key, text, ok: !!es.avisos[key] });
      if (fs.length > 1 && !esGrupo(nm)) av(`dup__${c.id}__${ident}`, `${nm} está em duas funções: ${fs.map((f) => ES_F[f].l).join(' e ')}`);
      if (ant[ident] && !esGrupo(nm)) av(`seg__${c.id}__${ident}`, `${nm} também serviu no culto anterior (${esDm(l[i - 1].date)})`);
      const v = ES_VBY[ident];
      if (v) {
        const dk = esDk(c.date);
        if ((v.dias || []).length && !v.dias.includes(dk)) av(`dia__${c.id}__${ident}`, `${nm} não está disponível ${esDia(c.date).toLowerCase()}`);
        fs.forEach((f) => { const rr = (v.restricoes || {})[f]; if (rr && rr.length && !rr.includes(dk)) av(`res__${c.id}__${ident}__${f}`, `${nm}: ${ES_F[f].l} só em ${rr.map((x) => ES_DIAS[ES_DK.indexOf(x)].toLowerCase()).join(', ')}`); });
      }
    }
    out[c.id] = r;
  });
  out._cont = cont;
  return out;
}
function esSituacao(c, A) {
  const r = A[c.id]; if (!r) return { t: 'mut', l: '—' };
  if (r.vazias.length) return { t: 'bad', l: `Faltam ${r.vazias.length} ${r.vazias.length > 1 ? 'funções' : 'função'}` };
  const w = r.avisos.filter((x) => !x.ok).length;
  return w ? { t: 'warn', l: `${w} aviso${w > 1 ? 's' : ''}` } : { t: 'ok', l: 'Completo' };
}
const esPill = (s) => `<span class="es-pill ${s.t}">${esc(s.l)}</span>`;

// ---------- banco ----------
async function esCarregar() {
  const [c, v, a, e] = await Promise.all(['cultos', 'voluntarios', 'avisos', 'envios'].map((t) => sb.from(t).select('id,data')));
  const erro = c.error || v.error || a.error || e.error;
  if (erro) { es.erro = erro; es.cultos = []; return renderEscalas(); }
  es.erro = null;
  es.semAcesso = !c.data.length && !v.data.length;
  es.cultos = c.data.map((x) => ({ ...x.data, id: x.id }));
  es.vols = v.data.map((x) => ({ ...x.data, id: x.id }));
  es.avisos = Object.fromEntries(a.data.map((x) => [x.id, true]));
  es.envios = Object.fromEntries(e.data.map((x) => [x.id, true]));
  esIndexar();
  renderEscalas();
}
async function esGravar(tabela, id, data) {
  const { error } = await sb.from(tabela).upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) toast('Não consegui salvar: ' + error.message);
  return !error;
}
async function esApagar(tabela, id) { const { error } = await sb.from(tabela).delete().eq('id', id); if (error) toast('Não consegui apagar: ' + error.message); }
function esSalvarCulto(c) { const d = esClone(c); delete d.id; esGravar('cultos', c.id, d); }
function esSalvarVol(v) { const d = esClone(v); delete d.id; esGravar('voluntarios', v.id, d); }
function esMudarCulto(id, fn) { const i = es.cultos.findIndex((c) => c.id === id); if (i < 0) return; const c = esClone(es.cultos[i]); c.assign = c.assign || {}; fn(c); es.cultos[i] = c; esSalvarCulto(c); renderEscalas(); }
function esMudarVol(id, fn) { const i = es.vols.findIndex((v) => v.id === id); if (i < 0) return; const v = esClone(es.vols[i]); fn(v); es.vols[i] = v; esIndexar(); esSalvarVol(v); }

// ---------- sugestão automática ----------
function esSugerir(c, A) {
  const l = esOrdenados(), i = l.findIndex((x) => x.id === c.id);
  const usados = esPessoas(c), vizinhos = { ...esPessoas(l[i - 1]), ...esPessoas(l[i + 1]) }, cont = { ...A._cont }, dk = esDk(c.date);
  let n = 0; c.assign = c.assign || {};
  for (const k of c.funcoes || []) {
    if (ES_SEM_SUGESTAO.includes(k)) continue;
    const falta = (ES_VAGAS[k] || 1) - ((c.assign[k] || []).length); if (falta <= 0) continue;
    const cand = es.vols.filter((v) => v.ativo !== false && (v.funcoes || []).includes(k) && !usados[v.id] && !vizinhos[v.id]
      && !((v.dias || []).length && !v.dias.includes(dk)) && !(((v.restricoes || {})[k] || []).length && !v.restricoes[k].includes(dk)))
      .sort((a, b) => (cont[a.id] || 0) - (cont[b.id] || 0) || a.nome.localeCompare(b.nome));
    for (let j = 0; j < falta && j < cand.length; j++) { const v = cand[j]; (c.assign[k] = c.assign[k] || []).push(v.nome); usados[v.id] = [k]; cont[v.id] = (cont[v.id] || 0) + 1; n++; }
  }
  return n;
}

// ---------- mensagens ----------
function esEscalados(filtro) {
  const P = {};
  for (const c of esOrdenados()) {
    if (filtro && !filtro(c)) continue;
    for (const k of c.funcoes || []) for (const n of (c.assign || {})[k] || []) { const i = esIdent(n); (P[i] = P[i] || { ident: i, nome: esNome(n), itens: [] }).itens.push({ c, k }); }
  }
  return Object.values(P).sort((a, b) => a.nome.localeCompare(b.nome));
}
const esFuncaoMsg = (k) => (k === 'oferta' ? 'Momento da Oferta' : k === 'abertura' ? 'Abertura do Culto' : ES_F[k].l);
function esLinhas(itens) {
  const por = {};
  for (const it of itens) (por[it.c.id] = por[it.c.id] || { c: it.c, f: [] }).f.push(esFuncaoMsg(it.k));
  return Object.values(por).map((o) => `• ${esDm(o.c.date)} (${esDia(o.c.date).toLowerCase()}, ${o.c.hora}) — ${o.f.join(' e ')}`).join('\n');
}
const esMsgMensal = (p, mes) => `Paz do Senhor, ${p.nome}! 🙏\n\nCom muita alegria, compartilhamos a escala de ${mes} da Diaconia. Você vai servir em:\n\n${esLinhas(p.itens)}\n\n${ES_AMOR}\n\nPedimos que chegue pelo menos 30 minutos antes, para nos prepararmos juntos com calma.\n\nObrigado por servir com amor na obra de Deus!\n\n${ES_ASSIN}`;
function esQuando(d) { const df = Math.round((esPd(d) - esPd(esYmd(new Date()))) / 86400000); return df === 0 ? 'hoje, ' : df === 1 ? 'amanhã, ' : ''; }
function esMsgLembrete(p, c) {
  const f = [...new Set(p.itens.map((it) => esFuncaoMsg(it.k)))].join(' e ');
  return `Paz, ${p.nome}! 🙏\n\nPassando com este lembrete para o culto de ${esQuando(c.date)}${esDia(c.date).toLowerCase()} (${esDm(c.date)}), às ${c.hora}.\n\nVocê serve em: ${f}.\n\n${ES_AMOR}\n\nChegue pelo menos 30 minutos antes, para nos prepararmos juntos com calma.${esPd(c.date).getDay() === 2 ? '\n\n📌 Ao final do culto, vamos empilhar as cadeiras para a aula de jiu-jitsu de quinta-feira.' : ''}\n\nDeus abençoe! ❤️\n\n${ES_ASSIN}`;
}
// O WhatsApp de alguns celulares estraga emoji no link; o texto do link vai sem emoji
const esSemEmoji = (t) => t.replace(/📌\s*/g, 'Importante: ').replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '').replace(/[ \t]+$/gm, '').replace(/ +([!.,?])/g, '$1');
const esLinkWa = (tel, txt) => `https://wa.me/${telefoneWa(tel)}?text=${encodeURIComponent(esSemEmoji(txt))}`;
function esItemMsg(p, chave, txt) {
  const v = ES_VBY[p.ident], tel = esTelefone(v), feito = !!es.envios[chave];
  return `<div class="card"><div class="linha" style="align-items:flex-start"><div class="info"><div class="nome">${esc(p.nome)} ${feito ? '<span class="es-pill ok">enviado</span>' : ''}</div>
    <div class="sub es-msg">${esc(txt)}</div></div></div>
    <div class="acoes" style="margin-top:10px">
      ${tel ? `<a class="btn btn-wa" href="${esc(esLinkWa(tel, txt))}" target="_blank" rel="noopener" data-es-enviado="${esc(chave)}">WhatsApp</a>` : `<button class="btn btn-sec" data-es-sub="vol" data-es-busca="${esc(p.nome)}">Cadastrar número</button>`}
      <button class="btn btn-sec" data-es-copiar="${esc(encodeURIComponent(txt))}">Copiar</button>
      <button class="btn btn-sec" data-es-marcar="${esc(chave)}">${feito ? 'Desmarcar' : 'Marcar enviado'}</button></div></div>`;
}

// ---------- telas ----------
function esBadge(c) {
  const d = esPd(c.date), k = esDk(c.date);
  return `<div class="es-data" style="background:${k === 'ter' ? '#151515' : k === 'sab' ? '#b87c10' : 'var(--red)'}"><b>${d.getDate()}</b><span>${ES_DIAS[d.getDay()].slice(0, 3)}</span></div>`;
}
function esMesesDisponiveis() { return [...new Set(es.cultos.map((c) => c.date.slice(0, 7)))].sort(); }
function esDoMes() { return esOrdenados().filter((c) => c.date.slice(0, 7) === es.mes); }
const esNomeMes = (k) => `${MESES[+k.slice(5, 7) - 1].replace(/^./, (x) => x.toUpperCase())} de ${k.slice(0, 4)}`;

function esTelaInicio(A) {
  const l = esDoMes(), hj = esYmd(new Date()), prox = esOrdenados().find((c) => c.date >= hj);
  let vazias = 0, avisos = 0, completos = 0;
  l.forEach((c) => { const s = esSituacao(c, A); if (s.t === 'ok') completos++; vazias += A[c.id].vazias.length; avisos += A[c.id].avisos.filter((w) => !w.ok).length; });
  const semTel = es.vols.filter((v) => v.ativo !== false && !esTelefone(v)).length;
  let h = `<div class="es-chips"><span class="es-pill ${completos === l.length ? 'ok' : 'mut'}">${completos} de ${l.length} completos</span>
    <span class="es-pill ${vazias ? 'bad' : 'ok'}">${vazias} ${vazias === 1 ? 'função vazia' : 'funções vazias'}</span>
    <span class="es-pill ${avisos ? 'warn' : 'ok'}">${avisos} aviso${avisos === 1 ? '' : 's'}</span>
    <span class="es-pill ${semTel ? 'warn' : 'ok'}">${semTel} sem WhatsApp</span></div>`;
  h += esPainelLembrete(A);
  if (prox) {
    const s = esSituacao(prox, A);
    h += `<h2>Próximo culto</h2><div class="card"><div class="linha">${esBadge(prox)}<div class="info"><div class="nome">${esc(prox.nome)}</div><div class="sub">${esDia(prox.date)}, ${esDm(prox.date)} • ${esc(prox.hora)}</div></div>${esPill(s)}</div>
      ${A[prox.id].vazias.length ? `<p class="aviso">Sem responsável: ${esc(A[prox.id].vazias.join(', '))}</p>` : ''}
      <div class="acoes"><button class="btn btn-sec" data-es-culto="${esc(prox.id)}">Abrir escala</button><button class="btn btn-sec" data-es-card="${esc(prox.id)}">Ver card</button></div></div>`;
  }
  h += `<h2>Cultos de ${esNomeMes(es.mes)}</h2>` + (l.map((c) => `<div class="card linha clicavel" data-es-culto="${esc(c.id)}">${esBadge(c)}<div class="info"><div class="nome">${esc(c.nome)}</div>
      <div class="sub">${esDm(c.date)} • ${esc(c.hora)}${A[c.id].vazias.length ? ' • faltam: ' + esc(A[c.id].vazias.join(', ')) : ''}</div></div>${esPill(esSituacao(c, A))}</div>`).join('') || '<div class="card vazio">Nenhum culto neste mês. Crie na aba Escala.</div>');
  return h;
}
function esPainelLembrete(A) {
  const am = new Date(); am.setDate(am.getDate() + 1);
  const hj = esYmd(new Date()), amanha = esYmd(am);
  const cs = esOrdenados().filter((c) => c.date === hj || c.date === amanha);
  if (!cs.length) return '';
  return cs.map((c) => {
    const ps = esEscalados((x) => x.id === c.id);
    const env = ps.filter((p) => es.envios[`r__${c.id}__${p.ident}`]).length;
    return `<h2>Lembrete — culto de ${c.date === hj ? 'hoje' : 'amanhã'}</h2>
      <div class="card" style="border-color:var(--red)"><div class="linha"><div class="info"><div class="nome">${esc(c.nome)}</div><div class="sub">${esDia(c.date)}, ${esDm(c.date)} • ${esc(c.hora)}</div></div>
      <span class="es-pill ${ps.length && env === ps.length ? 'ok' : 'warn'}">${env} de ${ps.length} avisados</span></div>
      ${A[c.id].vazias.length ? `<p class="aviso">Atenção: faltam ${esc(A[c.id].vazias.join(', '))}. Complete a escala antes de avisar.</p>` : ''}
      <div class="acoes"><button class="btn btn-pri" data-es-sub="msg" data-es-lembrete="${esc(c.date)}">Mandar lembretes</button></div></div>`;
  }).join('');
}
function esLinhaFuncao(c, k) {
  const nomes = (c.assign || {})[k] || [], f = ES_F[k], pes = esPessoas(c);
  const chips = nomes.map((n, i) => { const dup = (pes[esIdent(n)] || []).length > 1 && !esGrupo(n); return `<span class="es-chip${dup ? ' dup' : ''}">${esc(n)}<button data-es-tirar="${esc(c.id)}|${k}|${i}" aria-label="Tirar ${esc(n)}">×</button></span>`; }).join('');
  return `<div class="es-funcao"><div class="es-rot"><i style="background:${f.c}"></i>${esc(f.l)}</div><div class="es-chips">${chips}${nomes.length ? '' : '<span class="es-vazia">sem responsável</span>'}
    <input placeholder="+ nome" data-es-add="${esc(c.id)}|${k}" autocomplete="off" aria-label="Adicionar em ${esc(f.l)}"></div></div>`;
}
function esTelaEscala(A) {
  const l = esDoMes();
  let h = `<div class="card"><div class="nome">Novo culto</div><div class="grade">
      <div><label for="es-nc-data">Data</label><input type="date" id="es-nc-data"></div>
      <div><label for="es-nc-nome">Nome do culto</label><input id="es-nc-nome" placeholder="Ex.: Terça do Propósito"></div></div>
      <div class="acoes"><button class="btn btn-sec" id="es-nc-criar">Criar culto</button><button class="btn btn-pri" id="es-sug-mes">Sugerir vagas do mês</button></div>
      <p class="dica">O horário segue o dia (terça 20h, domingo 19h, sábado 19h30). Abertura, Oferta e Encerramento não entram na sugestão.</p></div>`;
  h += l.map((c) => {
    const r = A[c.id], extra = ES_FUNCOES.filter((f) => !(c.funcoes || []).includes(f.k));
    return `<div class="card es-culto" id="es-culto-${esc(c.id)}"><div class="linha">${esBadge(c)}<div class="info"><div class="nome">${esc(c.nome)}</div><div class="sub">${esDia(c.date)}, ${esDm(c.date)} • ${esc(c.hora)}</div></div>${esPill(esSituacao(c, A))}</div>
      ${r.avisos.length ? `<div class="es-avisos">${r.avisos.map((w) => `<div class="${w.ok ? 'ok' : ''}"><span>${w.ok ? '✓' : '⚠'} ${esc(w.text)}</span><button class="btn btn-sec" data-es-aviso="${esc(w.key)}">${w.ok ? 'Desfazer' : 'Manter assim'}</button></div>`).join('')}</div>` : ''}
      ${(c.funcoes || []).map((k) => esLinhaFuncao(c, k)).join('')}
      <div class="acoes"><select data-es-extra="${esc(c.id)}" aria-label="Adicionar função"><option value="">+ Função extra…</option>${extra.map((f) => `<option value="${f.k}">${esc(f.l)}</option>`).join('')}</select>
        <button class="btn btn-sec" data-es-sugerir="${esc(c.id)}">Sugerir</button><button class="btn btn-sec" data-es-card="${esc(c.id)}">Card</button></div></div>`;
  }).join('');
  return h;
}
function esTelaVol(A) {
  const q = esNorm(es.busca), cont = A._cont;
  const vs = es.vols.slice().sort((a, b) => a.nome.localeCompare(b.nome)).filter((v) => !q || esNorm(v.nome).includes(q) || (v.apelidos || []).some((x) => esNorm(x).includes(q)));
  let h = `<p class="dica">Os outros nomes fazem o app reconhecer “Paulo” e “Dc. Paulo Borato” como a mesma pessoa. Sem WhatsApp aqui, o app usa o telefone do cadastro de membros.</p>
    <div class="barra"><input id="es-busca" placeholder="Buscar voluntário" value="${esc(es.busca)}"></div>
    <div class="card"><div class="barra" style="margin:0"><input id="es-novo-vol" data-es-ac="novo" placeholder="Novo voluntário: comece a digitar o nome" autocomplete="off" autocapitalize="words"><button class="btn btn-pri" id="es-add-vol">Adicionar</button></div>
      <div class="sub" id="es-novo-info" style="margin-top:6px">${ES_NOVO_DICA}</div></div>`;
  h += vs.map((v) => {
    const tel = esTelefone(v), m = v.membro_id && estado.membros.find((x) => x.id === v.membro_id);
    return `<div class="card"><div class="linha">${avatar(m || { nome: v.nome })}<div class="info"><div class="nome">${esc(v.nome)}</div>
      <div class="sub">${cont[v.id] || 0} escala${(cont[v.id] || 0) === 1 ? '' : 's'} • ${m ? `cadastro: <a href="#" data-editar="${esc(m.id)}">${esc(m.nome)}</a>` : 'sem cadastro de membro'}</div></div>
      <span class="es-pill ${tel ? 'ok' : 'warn'}">${tel ? 'WhatsApp ok' : 'sem WhatsApp'}</span></div>
      <div class="grade">
        <div><label for="es-t-${esc(v.id)}">WhatsApp (com DDD)</label><input type="tel" id="es-t-${esc(v.id)}" value="${esc(v.telefone || '')}" placeholder="${m && m.telefone ? esc(m.telefone) : '41 99999-9999'}" data-es-campo="${esc(v.id)}|telefone"></div>
        <div class="inteiro"><label for="es-m-${esc(v.id)}">Cadastro de membro (digite para trocar)</label><input id="es-m-${esc(v.id)}" data-es-ac="vinculo|${esc(v.id)}" value="${esc(m ? m.nome : '')}" placeholder="Digite o nome do membro" autocomplete="off"></div>
        <div><label for="es-a-${esc(v.id)}">Outros nomes (vírgula)</label><input id="es-a-${esc(v.id)}" value="${esc((v.apelidos || []).join(', '))}" data-es-campo="${esc(v.id)}|apelidos"></div>
        <div class="inteiro"><label>Funções que pode fazer</label><div class="es-checks">${ES_FUNCOES.map((f) => `<label><input type="checkbox" data-es-check="${esc(v.id)}|funcoes|${f.k}"${(v.funcoes || []).includes(f.k) ? ' checked' : ''}>${esc(f.l)}</label>`).join('')}</div></div>
        <div class="inteiro"><label>Dias disponíveis (nenhum marcado = todos)</label><div class="es-checks">${ES_DK.map((d, i) => `<label><input type="checkbox" data-es-check="${esc(v.id)}|dias|${d}"${(v.dias || []).includes(d) ? ' checked' : ''}>${ES_DIAS[i].slice(0, 3)}</label>`).join('')}
          <label><input type="checkbox" data-es-check="${esc(v.id)}|ativo|1"${v.ativo === false ? '' : ' checked'}><b>Ativo nas escalas</b></label></div></div>
      </div></div>`;
  }).join('');
  return h;
}
function esTelaMsg(A) {
  const l = esDoMes(), mes = MESES[+es.mes.slice(5, 7) - 1];
  const pessoas = esEscalados((c) => c.date.slice(0, 7) === es.mes);
  const chave = (p) => `m__${esSlug(mes)}__${p.ident}`;
  const hj = esYmd(new Date()), futuros = esOrdenados().filter((c) => c.date >= hj);
  if (!es.lembrete || !futuros.some((c) => c.date === es.lembrete)) es.lembrete = (futuros[0] || {}).date || null;
  const cs = esOrdenados().filter((c) => c.date === es.lembrete);
  let h = `<p class="dica">O app prepara o texto de cada pessoa. Toque em “WhatsApp” no celular do chip da igreja e envie. O envio fica marcado aqui.</p>
    <h2>Lembrete do culto</h2>
    ${futuros.length ? `<select id="es-lembrete">${futuros.map((c) => `<option value="${c.date}"${c.date === es.lembrete ? ' selected' : ''}>${esDm(c.date)} — ${esc(c.nome)}</option>`).join('')}</select>` : '<div class="card vazio">Nenhum culto pela frente.</div>'}`;
  cs.forEach((c) => {
    h += (A[c.id].vazias.length ? `<p class="aviso">Antes de avisar: faltam ${esc(A[c.id].vazias.join(', '))}.</p>` : '<div style="height:10px"></div>')
      + esEscalados((x) => x.id === c.id).map((p) => esItemMsg(p, `r__${c.id}__${p.ident}`, esMsgLembrete(p, c))).join('');
  });
  h += `<details class="es-mensal"${es.verMensal ? ' open' : ''}><summary class="btn btn-sec" style="margin:18px 0 10px;display:block;text-align:center;list-style:none;cursor:pointer">${es.verMensal ? 'Esconder' : 'Ver'} a escala do mês de ${esc(mes)} (${pessoas.filter((p) => es.envios[chave(p)]).length} de ${pessoas.length} enviadas)</summary>`
    + (l.length ? pessoas.map((p) => esItemMsg(p, chave(p), esMsgMensal(p, mes))).join('') : '<div class="card vazio">Nenhum culto neste mês.</div>')
    + '</details>';
  return h;
}
function esTelaCard() {
  const l = esDoMes();
  if (!es.card || !es.cultos.some((c) => c.id === es.card)) { const hj = esYmd(new Date()); es.card = ((l.find((c) => c.date >= hj)) || l[0] || {}).id; }
  if (!es.card) return '<div class="card vazio">Nenhum culto neste mês.</div>';
  return `<p class="dica">Imagem do culto no padrão do Ministério. Baixe e envie nos grupos.</p>
    <div class="barra"><select id="es-card-sel">${esOrdenados().map((c) => `<option value="${c.id}"${c.id === es.card ? ' selected' : ''}>${esDm(c.date)} — ${esc(c.nome)}</option>`).join('')}</select></div>
    <div class="acoes" style="margin:0 0 12px"><button class="btn btn-pri" id="es-card-baixar">Baixar imagem</button><button class="btn btn-sec" id="es-card-partilhar">Compartilhar</button></div>
    <canvas id="es-cv" width="1080" height="1200" style="width:100%;height:auto;border:1px solid var(--line);border-radius:10px;background:#fff" aria-label="Card do culto"></canvas>`;
}

// ---------- card (imagem) ----------
const ES_LOGO = new Image(); ES_LOGO.src = 'img/logo-somos-um.png';
function esValorCard(c, k) {
  const n = (c.assign || {})[k] || []; if (!n.length) return [null];
  if ((k === 'recepcao' || k === 'apoio_recepcao') && n.length === 4) return [n[0] + ' e ' + n[1], n[2] + ' e ' + n[3]];
  return [n.join(k === 'distribuicao' ? ', ' : ' / ')];
}
function esRet(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function esDesenharCard(cv, c) {
  const W = 1080, pad = 60, ctx = cv.getContext('2d'), F = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', T = 'Georgia,"Times New Roman",serif';
  const ceia = ['leitura', 'oracao', 'distribuicao'], ks = (c.funcoes || []).slice();
  const linhas = ks.filter((k) => !ceia.includes(k)).map((k) => ({ k }));
  const ex = ceia.filter((k) => ks.includes(k)); if (ex.length) { linhas.push({ gap: true }); ex.forEach((k) => linhas.push({ k })); }
  ctx.font = '600 30px ' + F;
  const labw = Math.max(...linhas.filter((r) => r.k).map((r) => ctx.measureText(ES_F[r.k].l).width)) + 50;
  const vw = W - pad * 2 - 40 - labw - 20;
  const quebra = (t, larg, fonte) => { ctx.font = fonte; const o = []; let cur = ''; t.split(' ').forEach((w) => { const tr = (cur + ' ' + w).trim(); if (ctx.measureText(tr).width <= larg || !cur) cur = tr; else { o.push(cur); cur = w; } }); if (cur) o.push(cur); return o; };
  linhas.forEach((r) => { if (r.gap) { r.h = 44; return; } r.l = []; esValorCard(c, r.k).forEach((x) => (x === null ? r.l.push(null) : quebra(x, vw, '400 34px ' + F).forEach((y) => r.l.push(y)))); r.h = Math.max(1, r.l.length) * 44 + 30; });
  const tl = quebra(c.nome, W - 2 * pad, '700 58px ' + T);
  const tot = linhas.reduce((a, r) => a + r.h, 0);
  const notas = [quebra(ES_NOTA_CHEGADA, W - 2 * pad - 40, '400 27px ' + F)]; if (esPd(c.date).getDay() === 2) notas.push(quebra(ES_NOTA_TER, W - 2 * pad - 40, '400 27px ' + F));
  const nh = notas.reduce((a, n) => a + n.length * 38 + 66, 0);
  const H = 40 + 250 + 20 + tl.length * 72 + 60 + 40 + tot + 40 + nh + 110;
  cv.width = W; cv.height = H;
  ctx.fillStyle = '#faf9f8'; ctx.fillRect(0, 0, W, H);
  if (ES_LOGO.complete && ES_LOGO.naturalWidth) { const lw = 600, lh = Math.round(lw * ES_LOGO.naturalHeight / ES_LOGO.naturalWidth); ctx.drawImage(ES_LOGO, (W - lw) / 2, 40 + (250 - lh) / 2, lw, lh); }
  let y = 40 + 250 + 20; ctx.fillStyle = '#151515'; ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.font = '700 58px ' + T;
  tl.forEach((t) => { ctx.fillText(t, W / 2, y); y += 72; });
  const d = esPd(c.date);
  ctx.fillStyle = '#b01e1e'; ctx.font = '600 38px ' + F; ctx.fillText(`${esDia(c.date)}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}  •  ${c.hora}`, W / 2, y + 4); y += 60;
  ctx.fillRect(pad, y, W - 2 * pad, 4); y += 40;
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#ded7cd'; ctx.lineWidth = 2;
  esRet(ctx, pad - 10, y - 10, W - 2 * pad + 20, tot + 20, 24); ctx.fill(); ctx.stroke();
  linhas.forEach((r) => {
    if (r.gap) { y += r.h; return; }
    ctx.fillStyle = ES_F[r.k].c; ctx.fillRect(pad + 14, y + 24, 18, 18);
    ctx.fillStyle = '#151515'; ctx.font = '600 30px ' + F; ctx.fillText(ES_F[r.k].l, pad + 50, y + 15);
    ctx.font = '400 34px ' + F;
    r.l.forEach((t, i) => { ctx.fillStyle = t === null ? '#b01e1e' : '#2d2d2d'; ctx.fillText(t === null ? '(a definir)' : t, pad + 50 + labw, y + 12 + i * 44); });
    y += r.h;
  });
  y += 40;
  notas.forEach((nl) => { ctx.fillStyle = '#faecec'; ctx.strokeStyle = '#b01e1e'; esRet(ctx, pad - 10, y - 10, W - 2 * pad + 20, nl.length * 38 + 36, 18); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#781414'; ctx.font = '400 27px ' + F; nl.forEach((t, i) => ctx.fillText(t, pad + 20, y + 8 + i * 38)); y += nl.length * 38 + 66; });
  ctx.textAlign = 'center'; ctx.fillStyle = '#b01e1e'; ctx.font = '600 24px ' + F; ctx.fillText('MINISTÉRIO CRISTÃO SOMOS UM', W / 2, y + 10);
  ctx.fillStyle = '#78787a'; ctx.fillText('Resgatando Vidas', W / 2, y + 46);
}
function esArquivoCard(cb) {
  const c = es.cultos.find((x) => x.id === es.card), cv = $('#es-cv');
  cv.toBlob((b) => cb(new File([b], `escala_${esDm(c.date).replace('/', '-')}.png`, { type: 'image/png' })), 'image/png');
}

// ---------- desenho geral ----------
const ES_ABAS = [['inicio', 'Início'], ['escala', 'Escala'], ['vol', 'Voluntários'], ['msg', 'Mensagens'], ['cards', 'Card']];
function renderEscalas() {
  const el = $('#aba-escalas'); if (!el) return;
  if (es.cultos === null) { el.innerHTML = '<h2>Escalas da Diaconia</h2><div class="card vazio">Carregando…</div>'; esCarregar(); return; }
  if (es.erro) {
    el.innerHTML = `<h2>Escalas da Diaconia</h2><div class="aviso">${/permission|policy|row-level/i.test(es.erro.message) ? 'Seu login ainda não tem acesso às escalas. Falta rodar o arquivo 2026-11-22-escalas.sql no Supabase.' : 'Erro ao carregar: ' + esc(es.erro.message)}</div>`;
    return;
  }
  if (es.semAcesso) {
    el.innerHTML = '<h2>Escalas da Diaconia</h2><div class="aviso">As escalas não apareceram para o seu login. Se você não é o Anderson, falta ele rodar uma vez o arquivo 2026-11-22-escalas.sql no Supabase. Depois disso, quem tem acesso ao app vê as escalas.</div>';
    return;
  }
  const meses = esMesesDisponiveis();
  const hj = esYmd(new Date()), prox = esOrdenados().find((c) => c.date >= hj);
  if (!es.mes) es.mes = prox ? prox.date.slice(0, 7) : meses[meses.length - 1] || hj.slice(0, 7);
  if (!meses.includes(es.mes)) meses.push(es.mes), meses.sort();
  const A = esAnalisar();
  const tela = { inicio: esTelaInicio, escala: esTelaEscala, vol: esTelaVol, msg: esTelaMsg, cards: esTelaCard }[es.sub] || esTelaInicio;
  el.innerHTML = `<div class="es-topo"><h2 style="margin:0">Escalas da Diaconia</h2>
      ${es.sub !== 'vol' ? `<select id="es-mes" aria-label="Mês">${meses.map((m) => `<option value="${m}"${m === es.mes ? ' selected' : ''}>${esNomeMes(m)}</option>`).join('')}</select>` : ''}</div>
    <div class="es-abas" role="tablist">${ES_ABAS.map(([k, n]) => `<button role="tab" aria-selected="${es.sub === k}" class="${es.sub === k ? 'ativo' : ''}" data-es-sub="${k}">${n}</button>`).join('')}</div>
    ${tela(A)}`;
  if (es.sub === 'cards') {
    const cv = $('#es-cv'), c = es.cultos.find((x) => x.id === es.card);
    if (cv && c) { const d = () => esDesenharCard(cv, c); ES_LOGO.complete ? d() : (ES_LOGO.onload = d); d(); }
  }
}

function esIr(sub) { es.sub = sub; try { localStorage.setItem('es_sub', sub); } catch (e) { /* ok */ } renderEscalas(); window.scrollTo(0, 0); }
function esAdicionar(id, k, val) {
  val = String(val || '').trim(); if (!val) return;
  const v = esVol(val), nome = v ? v.nome : val;
  const c = es.cultos.find((x) => x.id === id);
  if (((c.assign || {})[k] || []).some((n) => esIdent(n) === esIdent(nome))) return toast(nome + ' já está nesta função.');
  esMudarCulto(id, (cc) => (cc.assign[k] = cc.assign[k] || []).push(nome));
  if (!v && !esGrupo(val)) toast(val + ' não está cadastrado em Voluntários.');
}

document.addEventListener('click', (e) => {
  const alvo = e.target.closest('#aba-escalas [data-es-sub],#aba-escalas [data-es-culto],#aba-escalas [data-es-card],#aba-escalas [data-es-tirar],#aba-escalas [data-es-aviso],#aba-escalas [data-es-sugerir],#aba-escalas [data-es-copiar],#aba-escalas [data-es-marcar],#aba-escalas [data-es-enviado],#aba-escalas button[id^="es-"]');
  if (!alvo) return;
  const ds = alvo.dataset;
  if (ds.esEnviado) { es.envios[ds.esEnviado] = true; esGravar('envios', ds.esEnviado, { at: new Date().toISOString() }); setTimeout(renderEscalas, 300); return; }
  if (ds.esSub) { if (ds.esBusca !== undefined) es.busca = ds.esBusca; if (ds.esLembrete) es.lembrete = ds.esLembrete; return esIr(ds.esSub); }
  if (ds.esCulto) { es.mes = ds.esCulto.slice(0, 7); esIr('escala'); const x = document.getElementById('es-culto-' + ds.esCulto); if (x) x.scrollIntoView({ block: 'start' }); return; }
  if (ds.esCard) { es.card = ds.esCard; es.mes = ds.esCard.slice(0, 7); return esIr('cards'); }
  if (ds.esTirar) { const [id, k, i] = ds.esTirar.split('|'); return esMudarCulto(id, (c) => c.assign[k].splice(+i, 1)); }
  if (ds.esAviso) { const k = ds.esAviso; if (es.avisos[k]) { delete es.avisos[k]; esApagar('avisos', k); } else { es.avisos[k] = true; esGravar('avisos', k, { ok: true }); } return renderEscalas(); }
  if (ds.esSugerir) { const cc = esClone(es.cultos.find((x) => x.id === ds.esSugerir)); const n = esSugerir(cc, esAnalisar()); if (n) esMudarCulto(cc.id, (c) => (c.assign = cc.assign)); return toast(n ? `${n} nome${n > 1 ? 's' : ''} sugerido${n > 1 ? 's' : ''}. Abertura, Oferta e Encerramento ficam com você.` : 'Nada a sugerir: confira funções e dias dos voluntários.'); }
  if (ds.esCopiar) return navigator.clipboard.writeText(decodeURIComponent(ds.esCopiar)).then(() => toast('Texto copiado.'), () => toast('Não foi possível copiar.'));
  if (ds.esMarcar) { const k = ds.esMarcar; if (es.envios[k]) { delete es.envios[k]; esApagar('envios', k); } else { es.envios[k] = true; esGravar('envios', k, { at: new Date().toISOString() }); } return renderEscalas(); }
  if (alvo.id === 'es-sug-mes') {
    let tot = 0, A = esAnalisar();
    for (const c of esDoMes()) { const cc = esClone(c); cc.assign = cc.assign || {}; const n = esSugerir(cc, A); if (n) { tot += n; es.cultos[es.cultos.findIndex((x) => x.id === c.id)] = cc; esSalvarCulto(cc); A = esAnalisar(); } }
    renderEscalas(); return toast(tot ? `${tot} nomes sugeridos no mês.` : 'Nada a sugerir.');
  }
  if (alvo.id === 'es-nc-criar') {
    const d = $('#es-nc-data').value, nm = $('#es-nc-nome').value.trim();
    if (!d || !nm) return toast('Informe a data e o nome do culto.');
    if (es.cultos.some((c) => c.id === d)) return toast('Já existe um culto nesta data.');
    const c = { id: d, date: d, nome: nm, hora: ES_HORA[esPd(d).getDay()] || '19h', funcoes: ES_BASE.slice(), assign: {} };
    es.cultos.push(c); esSalvarCulto(c); es.mes = d.slice(0, 7); renderEscalas(); return toast('Culto criado.');
  }
  if (alvo.id === 'es-add-vol') {
    const nm = $('#es-novo-vol').value.trim(); if (!nm) return;
    const id = esSlug(nm); if (ES_VBY[id]) return toast('Esse voluntário já existe.');
    const m = (es.novoMembro && estado.membros.find((x) => x.id === es.novoMembro)) || estado.membros.find((x) => esNorm(x.nome) === esNorm(nm.replace(/^(pr|pra|dc|dca|pb|ev|miss)\.\s*/i, '')));
    const ja = m && es.vols.find((x) => x.membro_id === m.id); if (ja) return toast(m.nome + ' já é voluntário (' + ja.nome + ').');
    es.novoMembro = null;
    const v = { id, nome: nm, telefone: '', ativo: true, funcoes: [], dias: [], apelidos: [], restricoes: {}, notas: '', membro_id: m ? m.id : null };
    es.vols.push(v); esIndexar(); esSalvarVol(v); es.busca = nm; return renderEscalas();
  }
  if (alvo.id === 'es-card-baixar') return esArquivoCard((f) => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  if (alvo.id === 'es-card-partilhar') return esArquivoCard((f) => {
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f] }).catch(() => {});
    else toast('Este aparelho não compartilha imagem direto. Use "Baixar imagem".');
  });
});
document.addEventListener('keydown', (e) => { const ds = e.target.dataset || {}; if (e.key === 'Enter' && ds.esAdd) { const [id, k] = ds.esAdd.split('|'), val = e.target.value; e.target.value = ''; esAdicionar(id, k, val); } });
document.addEventListener('change', (e) => {
  const t = e.target, ds = t.dataset || {};
  if (!t.closest || !t.closest('#aba-escalas')) return;
  if (ds.esAdd) { const val = t.value; if (!esVol(val) && !esGrupo(val)) return; const [id, k] = ds.esAdd.split('|'); t.value = ''; return esAdicionar(id, k, val); }
  if (ds.esAc) return;
  if (ds.esExtra) { if (t.value) esMudarCulto(ds.esExtra, (c) => (c.funcoes = c.funcoes || []).push(t.value)); return; }
  if (t.id === 'es-mes') { es.mes = t.value; return renderEscalas(); }
  if (t.id === 'es-lembrete') { es.lembrete = t.value; return renderEscalas(); }
  if (t.id === 'es-card-sel') { es.card = t.value; return renderEscalas(); }
  if (ds.esCampo) { const [id, campo] = ds.esCampo.split('|'); esMudarVol(id, (v) => { if (campo === 'telefone') v.telefone = t.value.replace(/[^\d+ ()-]/g, '').trim(); else v.apelidos = t.value.split(',').map((x) => x.trim()).filter(Boolean); }); return renderEscalas(); }
  if (ds.esCheck) { const [id, campo, val] = ds.esCheck.split('|'); esMudarVol(id, (v) => { if (campo === 'ativo') { v.ativo = t.checked; return; } const l = (v[campo] = v[campo] || []), i = l.indexOf(val); if (t.checked && i < 0) l.push(val); if (!t.checked && i >= 0) l.splice(i, 1); }); return renderEscalas(); }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'es-busca') return;
  es.busca = e.target.value; const pos = e.target.selectionStart; renderEscalas();
  const n = $('#es-busca'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
});
document.addEventListener('toggle', (e) => {
  const d = e.target;
  if (!d.classList || !d.classList.contains('es-mensal')) return;
  es.verMensal = d.open;
  const s = d.querySelector('summary'); if (s) s.textContent = s.textContent.replace(/^(Ver|Esconder)/, d.open ? 'Esconder' : 'Ver');
}, true);

// ---------- autocompletar nomes (membros e voluntários) ----------
// Busca sem acento e por qualquer parte do nome ("joao sil" acha "João da Silva"), com foto pequena.
const ES_NOVO_DICA = 'Aparecem sugestões do cadastro de membros. Escolha uma para ligar o voluntário à pessoa certa.';
let ES_AC = null; // { input, itens, sel }
function esCasa(nome, q) {
  const n = esNorm(nome), ps = q.split(' ').filter(Boolean);
  if (!ps.length || !ps.every((p) => n.includes(p))) return -1;
  return n.startsWith(q) ? 0 : n.split(' ').some((w) => w.startsWith(ps[0])) ? 1 : 2;
}
function esOpcoesAc(input) {
  const q = esNorm(input.value), ds = input.dataset; if (!q) return [];
  let l;
  if (ds.esAdd) {
    const k = ds.esAdd.split('|')[1];
    l = es.vols.filter((v) => v.ativo !== false).map((v) => {
      const r = Math.min(...[v.nome, ...(v.apelidos || [])].map((n) => { const x = esCasa(n, q); return x < 0 ? 9 : x; }));
      const faz = (v.funcoes || []).includes(k), m = v.membro_id && estado.membros.find((x) => x.id === v.membro_id);
      return { r: r === 9 ? 9 : r + (faz ? 0 : 3), nome: v.nome, valor: v.nome, m: m || { nome: v.nome }, sub: faz ? '' : 'não marcado nesta função' };
    }).filter((o) => o.r < 9);
  } else {
    const vinc = {}; es.vols.forEach((v) => v.membro_id && (vinc[v.membro_id] = v));
    l = estado.membros.map((m) => ({ r: esCasa(m.nome, q), m })).filter((o) => o.r >= 0).map(({ r, m }) => {
      const inativo = m.situacao && m.situacao !== 'ativo';
      const idade = m.nascimento ? Math.floor((Date.now() - new Date(m.nascimento + 'T12:00')) / 315576e5) : null;
      const sub = [vinc[m.id] ? 'já é voluntário' : '', inativo ? m.situacao : '', idade !== null && idade < 18 ? idade + ' anos' : ''].filter(Boolean).join(' • ');
      return { r: r + (inativo ? 3 : 0), nome: m.nome, valor: m.id, m, sub };
    });
  }
  return l.sort((a, b) => a.r - b.r || a.nome.localeCompare(b.nome)).slice(0, 7);
}
function esFecharAc() { const b = document.getElementById('es-ac'); if (b) b.remove(); ES_AC = null; }
function esAbrirAc(input) {
  const itens = esOpcoesAc(input);
  if (!itens.length) { esFecharAc(); return; }
  let b = document.getElementById('es-ac');
  if (!b) { b = document.createElement('div'); b.id = 'es-ac'; b.setAttribute('role', 'listbox'); document.body.appendChild(b); }
  ES_AC = { input, itens, sel: 0 };
  b.innerHTML = itens.map((o, i) => `<div class="es-ac-op${i === 0 ? ' sel' : ''}" role="option" data-es-ac-i="${i}">${avatar(o.m)}<div><b>${esc(o.nome)}</b>${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</div></div>`).join('');
  const r = input.getBoundingClientRect(), w = Math.min(Math.max(r.width, 260), window.innerWidth - 16);
  b.style.width = w + 'px';
  b.style.left = (Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + window.scrollX) + 'px';
  b.style.top = (r.bottom + window.scrollY + 4) + 'px';
}
function esEscolherAc(i) {
  if (!ES_AC) return; const { input, itens } = ES_AC, o = itens[i]; esFecharAc(); if (!o) return;
  const ds = input.dataset;
  if (ds.esAdd) { const [id, k] = ds.esAdd.split('|'); input.value = ''; return esAdicionar(id, k, o.valor); }
  if (ds.esAc === 'novo') {
    input.value = o.nome; es.novoMembro = o.valor;
    const inf = $('#es-novo-info'); if (inf) inf.innerHTML = `✓ Vai ficar ligado ao cadastro de <b>${esc(o.nome)}</b>. Se quiser, coloque o título na frente (Dc., Pb.…) e toque em Adicionar.`;
    return;
  }
  if (ds.esAc && ds.esAc.startsWith('vinculo|')) {
    const vid = ds.esAc.split('|')[1], ja = es.vols.find((x) => x.membro_id === o.valor && x.id !== vid);
    if (ja) { input.value = input.defaultValue; return toast(o.nome + ' já está ligado ao voluntário ' + ja.nome + '.'); }
    esMudarVol(vid, (v) => (v.membro_id = o.valor)); renderEscalas(); toast('Ligado ao cadastro de ' + o.nome + '.');
  }
}
document.addEventListener('input', (e) => {
  const t = e.target; if (!t.closest || !t.closest('#aba-escalas') || !(t.dataset.esAdd || t.dataset.esAc)) return;
  if (t.dataset.esAc === 'novo' && es.novoMembro) { es.novoMembro = null; const inf = $('#es-novo-info'); if (inf) inf.textContent = ES_NOVO_DICA; }
  esAbrirAc(t);
});
document.addEventListener('focusin', (e) => { const t = e.target; if (t.closest && t.closest('#aba-escalas') && (t.dataset.esAdd || t.dataset.esAc) && t.value && !(t.dataset.esAc || '').startsWith('vinculo|')) esAbrirAc(t); });
// Ao sair do campo: fecha a lista; no campo de vínculo, volta a mostrar o nome atual se nada foi escolhido
document.addEventListener('focusout', (e) => {
  const t = e.target;
  setTimeout(() => {
    if (document.activeElement === t) return;
    if (ES_AC && ES_AC.input === t) esFecharAc();
    if ((t.dataset && t.dataset.esAc || '').startsWith('vinculo|') && t.isConnected) t.value = t.defaultValue;
  }, 150);
});
// Tocar na sugestão não tira o foco do campo (o teclado do celular não pisca e o toque não se perde)
['pointerdown', 'mousedown'].forEach((ev) => document.addEventListener(ev, (e) => { if (e.target.closest && e.target.closest('#es-ac')) e.preventDefault(); }));
document.addEventListener('click', (e) => { const op = e.target.closest && e.target.closest('[data-es-ac-i]'); if (op) esEscolherAc(+op.dataset.esAcI); });
document.addEventListener('keydown', (e) => {
  if (!ES_AC || e.target !== ES_AC.input) return;
  const b = document.getElementById('es-ac'), n = ES_AC.itens.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); ES_AC.sel = (ES_AC.sel + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    b.querySelectorAll('.es-ac-op').forEach((x, i) => x.classList.toggle('sel', i === ES_AC.sel));
  } else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); esEscolherAc(ES_AC.sel); }
  else if (e.key === 'Escape') esFecharAc();
}, true);
window.addEventListener('resize', () => { if (ES_AC) esAbrirAc(ES_AC.input); });
