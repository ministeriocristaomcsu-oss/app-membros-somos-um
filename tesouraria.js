// Tesouraria (antigo app "Caixa Somos Um"), dentro do app de membros.
// Só aparece para quem está marcado como tesoureiro em Ajustes → Acessos; o banco bloqueia o resto (RLS).
// Usa do index.html: sb, estado, $, esc, toast, MESES.
const TS_CAT_ENTRADA = ['Dízimos', 'Ofertas', 'Doações', 'Eventos/Campanhas', 'Outras Entradas'];
const TS_CAT_SAIDA = ['Água', 'Luz', 'Telefone/Internet', 'Aluguel', 'Salários', 'Manutenção', 'Materiais/Suprimentos', 'Ação Social', 'Oferta Pregadores/Cantores/Teatro', 'Outras Saídas'];
const TS_FORMAS = ['Dinheiro', 'Pix', 'TED', 'Cartão de Crédito', 'Cartão de Débito'];

const ts = { mes: null, lanc: null, fixas: [], saldoAnt: { dinheiro: 0, banco: 0 }, erro: null, form: null, formFixa: false, carregando: false };

function tsHojeIso() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function tsMoeda(n) { return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function tsData(iso) { const [a, m, d] = String(iso).split('-'); return `${d}/${m}/${a}`; }
function tsMesNome(k) { const [a, m] = k.split('-'); return `${MESES[+m - 1]} de ${a}`; }
function tsMudaMes(k, n) { const [a, m] = k.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function tsFimMes(k) { return tsMudaMes(k, 1) + '-01'; }
function tsNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function tsMembro(id) { return id ? estado.membros.find((m) => m.id === id) : null; }

// Sugere o membro de um dízimo pelo nome escrito na descrição ("Pix recebido - Maria Feijó", "Dízimo Maria Aparecida")
function tsSugerirMembro(desc) {
  const d = ' ' + tsNorm(desc) + ' ';
  let melhor = null, pontos = 0;
  for (const m of estado.membros) {
    const p = tsNorm(m.nome).split(' ').filter((x) => x.length > 2 && !['dos', 'das', 'de', 'da', 'do'].includes(x));
    if (p.length < 2 || !d.includes(' ' + p[0] + ' ')) continue;
    const n = p.filter((x) => d.includes(' ' + x + ' ')).length;
    if (n >= 2 && n > pontos) { melhor = m; pontos = n; }
  }
  return melhor;
}

async function tsCarregar() {
  if (ts.carregando) return;
  ts.carregando = true;
  const ini = ts.mes + '-01', fim = tsFimMes(ts.mes);
  const [l, f, a] = await Promise.all([
    sb.from('tesouraria_lancamentos').select('*').gte('data', ini).lt('data', fim).order('data', { ascending: false }).order('criado_em', { ascending: false }),
    sb.from('tesouraria_contas_fixas').select('*').eq('ativa', true).order('dia_vencimento'),
    sb.from('tesouraria_lancamentos').select('tipo,valor,forma_pagamento').lt('data', ini),
  ]);
  ts.carregando = false;
  const erro = l.error || f.error || a.error;
  if (erro) { ts.erro = erro; ts.lanc = []; return renderTesouraria(); }
  ts.erro = null; ts.lanc = l.data.map((x) => ({ ...x, valor: Number(x.valor) })); ts.fixas = f.data.map((x) => ({ ...x, valor: Number(x.valor) }));
  const s = { dinheiro: 0, banco: 0 };
  for (const x of a.data) s[x.forma_pagamento === 'Dinheiro' ? 'dinheiro' : 'banco'] += (x.tipo === 'entrada' ? 1 : -1) * Number(x.valor);
  ts.saldoAnt = s;
  renderTesouraria();
}

function tsTotais(lista) {
  const t = { e: 0, s: 0, catE: {}, catS: {}, formaE: {}, formaS: {}, dinheiro: 0, banco: 0 };
  for (const x of lista) {
    const f = x.forma_pagamento || 'Não informado';
    if (x.tipo === 'entrada') { t.e += x.valor; t.catE[x.categoria] = (t.catE[x.categoria] || 0) + x.valor; t.formaE[f] = (t.formaE[f] || 0) + x.valor; }
    else { t.s += x.valor; t.catS[x.categoria] = (t.catS[x.categoria] || 0) + x.valor; t.formaS[f] = (t.formaS[f] || 0) + x.valor; }
    t[x.forma_pagamento === 'Dinheiro' ? 'dinheiro' : 'banco'] += (x.tipo === 'entrada' ? 1 : -1) * x.valor;
  }
  return t;
}

function tsBarras(obj, cor) {
  const itens = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!itens.length) return '<p class="dica">Sem lançamentos.</p>';
  const max = itens[0][1] || 1;
  return '<div class="hbarras ts-barras">' + itens.map(([k, v]) => `<div class="item"><span>${esc(k)}</span>
    <span class="trilho"><span class="preench" style="width:${(v / max) * 100}%;background:${cor}"></span></span><span class="n">${tsMoeda(v)}</span></div>`).join('') + '</div>';
}

function tsOpcoes(lista, atual) { return lista.map((o) => `<option${o === atual ? ' selected' : ''}>${esc(o)}</option>`).join(''); }

function tsFormHtml() {
  const x = ts.form;
  const novo = !x.id;
  const cats = x.tipo === 'entrada' ? TS_CAT_ENTRADA : TS_CAT_SAIDA;
  const m = tsMembro(x.membro_id);
  return `<div class="card" id="ts-form">
    <div class="nome" style="margin-bottom:4px">${novo ? 'Novo lançamento' : 'Editar lançamento'}</div>
    <div class="grade">
      <div><label for="tsf-tipo">Tipo</label><select id="tsf-tipo"><option value="entrada"${x.tipo === 'entrada' ? ' selected' : ''}>Entrada</option><option value="saida"${x.tipo === 'saida' ? ' selected' : ''}>Saída</option></select></div>
      <div><label for="tsf-fixa">Natureza</label><select id="tsf-fixa"><option value="0">Variável</option><option value="1"${x.fixa ? ' selected' : ''}>Fixa</option></select></div>
      <div class="inteiro"><label for="tsf-desc">Descrição</label><input id="tsf-desc" value="${esc(x.descricao || '')}" placeholder="Ex.: Oferta do culto de domingo"></div>
      <div><label for="tsf-data">Data</label><input id="tsf-data" type="date" value="${esc(x.data)}"></div>
      <div><label for="tsf-valor">Valor (R$)</label><input id="tsf-valor" type="number" inputmode="decimal" step="0.01" min="0" value="${x.valor ?? ''}" placeholder="0,00"></div>
      <div><label for="tsf-cat">Categoria</label><select id="tsf-cat">${tsOpcoes(cats, x.categoria)}</select></div>
      <div><label for="tsf-forma">Forma de pagamento</label><select id="tsf-forma">${tsOpcoes(TS_FORMAS, x.forma_pagamento || 'Dinheiro')}</select></div>
      <div class="inteiro${x.tipo === 'entrada' ? '' : ' oculto'}" id="tsf-membro-bloco"><label for="tsf-membro">Membro (para dízimos e ofertas de alguém, opcional)</label>
        <input id="tsf-membro" list="tsf-membros" value="${esc(m ? m.nome : '')}" placeholder="Digite o nome" autocomplete="off">
        <datalist id="tsf-membros">${estado.membros.filter((p) => p.situacao === 'ativo').map((p) => `<option value="${esc(p.nome)}">`).join('')}</datalist>
        ${x.sugerido ? `<p class="dica">Sugestão pelo nome na descrição. Confira antes de salvar.</p>` : ''}</div>
    </div>
    <div class="acoes"><button class="btn btn-sec" id="tsf-cancelar">Cancelar</button>
      ${novo ? '' : '<button class="btn btn-perigo" id="tsf-excluir">Excluir</button>'}
      <button class="btn btn-pri" id="tsf-salvar">${novo ? 'Salvar lançamento' : 'Salvar alterações'}</button></div>
  </div>`;
}

function tsFixasHtml() {
  const pagas = {};
  for (const x of ts.lanc) if (x.conta_fixa_id) pagas[x.conta_fixa_id] = x;
  const atual = ts.mes === tsHojeIso().slice(0, 7);
  const lista = ts.fixas.map((f) => {
    const pago = pagas[f.id];
    let alerta = '';
    if (!pago && atual) {
      const dif = Math.round((new Date(ts.mes + '-' + String(Math.min(f.dia_vencimento, 28)).padStart(2, '0') + 'T00:00:00') - new Date(tsHojeIso() + 'T00:00:00')) / 86400000);
      if (dif <= 3) alerta = `<span class="tag">${dif < 0 ? 'Atrasada' : dif === 0 ? 'Vence hoje' : `Vence em ${dif} dia${dif > 1 ? 's' : ''}`}</span>`;
    }
    return `<div class="card linha"><div class="info"><div class="nome">${esc(f.nome)} ${alerta}</div>
      <div class="sub">${esc(f.categoria)} · todo dia ${f.dia_vencimento}${f.forma_pagamento ? ' · ' + esc(f.forma_pagamento) : ''} · ${tsMoeda(f.valor)}</div></div>
      ${pago ? `<span class="enviado">✓ Pago ${tsData(pago.data).slice(0, 5)}</span>` : `<button class="btn btn-pri" data-ts-lancar-fixa="${esc(f.id)}">Lançar</button>`}
      <button class="btn btn-sec" style="padding:8px 10px" data-ts-remover-fixa="${esc(f.id)}" title="Parar de repetir" aria-label="Remover conta fixa">✕</button></div>`;
  }).join('');
  const form = ts.formFixa ? `<div class="card"><div class="grade">
      <div class="inteiro"><label for="tsx-nome">Nome da conta</label><input id="tsx-nome" placeholder="Ex.: Internet da igreja"></div>
      <div><label for="tsx-tipo">Tipo</label><select id="tsx-tipo"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></div>
      <div><label for="tsx-dia">Dia do mês</label><input id="tsx-dia" type="number" min="1" max="31" placeholder="10"></div>
      <div><label for="tsx-cat">Categoria</label><select id="tsx-cat">${tsOpcoes(TS_CAT_SAIDA)}</select></div>
      <div><label for="tsx-forma">Forma de pagamento</label><select id="tsx-forma">${tsOpcoes(TS_FORMAS, 'Pix')}</select></div>
      <div><label for="tsx-valor">Valor (R$)</label><input id="tsx-valor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00"></div>
    </div><div class="acoes"><button class="btn btn-sec" id="tsx-cancelar">Cancelar</button><button class="btn btn-pri" id="tsx-salvar">Salvar conta fixa</button></div></div>`
    : '<div class="acoes" style="margin-top:4px"><button class="btn btn-sec" id="ts-nova-fixa">+ Nova conta fixa</button></div>';
  return (lista || '<div class="card vazio">Nenhuma conta fixa cadastrada.</div>') + form;
}

function tsDizimosHtml() {
  const ent = ts.lanc.filter((x) => x.tipo === 'entrada' && x.categoria === 'Dízimos');
  if (!ent.length) return '';
  const por = {};
  for (const x of ent) if (x.membro_id) { (por[x.membro_id] = por[x.membro_id] || { n: 0, v: 0 }); por[x.membro_id].n++; por[x.membro_id].v += x.valor; }
  const sem = ent.filter((x) => !x.membro_id);
  const linhas = Object.entries(por).sort((a, b) => b[1].v - a[1].v).map(([id, o]) => {
    const m = tsMembro(id);
    return `<div class="linha" style="padding:6px 0;border-bottom:1px dashed var(--line)"><div class="info">${esc(m ? m.nome : 'Membro removido')}</div><span class="sub">${o.n}×</span><b style="font-variant-numeric:tabular-nums">${tsMoeda(o.v)}</b></div>`;
  }).join('');
  return `<h2>Dízimos por membro</h2><div class="card">
    ${linhas || '<p class="dica" style="margin:0">Nenhum dízimo ligado a um membro neste mês.</p>'}
    ${sem.length ? `<p class="dica">${sem.length} ${sem.length === 1 ? 'dízimo está' : 'dízimos estão'} sem membro. Toque no lançamento para escolher a pessoa (o app sugere pelo nome).</p>` : ''}
    <p class="dica">Só tesoureiros veem esta lista.</p></div>`;
}

function renderTesouraria() {
  const el = $('#aba-tesouraria');
  if (!el) return;
  if (!estado.souTesoureiro) { el.innerHTML = '<h2>Tesouraria</h2><div class="card vazio">Só quem está marcado como tesoureiro em Ajustes → Acessos vê a Tesouraria.</div>'; return; }
  if (!ts.mes) ts.mes = tsHojeIso().slice(0, 7);
  if (ts.lanc === null) { el.innerHTML = '<h2>Tesouraria</h2><div class="card vazio">Carregando…</div>'; tsCarregar(); return; }
  if (ts.erro) {
    const falta = /tesouraria|schema cache|does not exist/i.test(ts.erro.message || '');
    el.innerHTML = `<h2>Tesouraria</h2><div class="aviso">${falta ? 'Falta rodar o SQL da Tesouraria no Supabase (arquivo 2026-11-22-tesouraria-com-dados.sql). O Anderson já recebeu. Depois de rodar, abra o app de novo.' : 'Erro ao carregar: ' + esc(ts.erro.message)}</div>`;
    return;
  }
  const t = tsTotais(ts.lanc);
  const saldo = t.e - t.s;
  const ac = { dinheiro: ts.saldoAnt.dinheiro + t.dinheiro, banco: ts.saldoAnt.banco + t.banco };
  const dias = {};
  for (const x of ts.lanc) (dias[x.data] = dias[x.data] || []).push(x);
  const razao = Object.keys(dias).sort().reverse().map((d) => `<div class="data-grupo">${tsData(d)}</div>` + dias[d].map((x) => {
    const m = tsMembro(x.membro_id);
    return `<div class="card linha clicavel" data-ts-editar="${esc(x.id)}" style="padding:10px 12px">
      <span style="width:10px;height:10px;border-radius:50%;flex:none;background:${x.tipo === 'entrada' ? 'var(--green)' : 'var(--red)'}"></span>
      <div class="info"><div class="nome" style="font-weight:500">${esc(x.descricao)}</div>
      <div class="sub">${esc(x.categoria)} · ${x.fixa ? 'fixa' : 'variável'}${x.forma_pagamento ? ' · ' + esc(x.forma_pagamento) : ''}${m ? ' · 👤 ' + esc(m.nome) : ''}</div></div>
      <b style="white-space:nowrap;font-variant-numeric:tabular-nums;color:${x.tipo === 'entrada' ? 'var(--green)' : 'var(--ink)'}">${x.tipo === 'entrada' ? '+' : '−'} ${tsMoeda(x.valor)}</b></div>`;
  }).join('')).join('');

  el.innerHTML = `<div class="linha" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn btn-sec" id="ts-ant" aria-label="Mês anterior">‹</button>
      <b>${tsMesNome(ts.mes).replace(/^./, (c) => c.toUpperCase())}</b>
      <button class="btn btn-sec" id="ts-prox" aria-label="Próximo mês">›</button></div>
    <div class="card" style="background:#111;color:#fff;border-color:#111">
      <div style="font-size:13px;opacity:.75">Saldo em caixa (acumulado até o fim do mês)</div>
      <div style="font-size:30px;font-weight:700;font-variant-numeric:tabular-nums">${tsMoeda(ac.dinheiro + ac.banco)}</div>
      <div class="linha" style="gap:18px;margin-top:6px;font-size:14px"><span>💵 Dinheiro <b>${tsMoeda(ac.dinheiro)}</b></span><span>🏦 Banco <b>${tsMoeda(ac.banco)}</b></span></div>
    </div>
    <div class="kpis ts-kpis">
      <div class="card kpi"><div class="num" style="font-size:clamp(14px,4.2vw,20px);color:var(--green)">${tsMoeda(t.e)}</div><div class="rot">Entradas</div></div>
      <div class="card kpi"><div class="num" style="font-size:clamp(14px,4.2vw,20px)">${tsMoeda(t.s)}</div><div class="rot">Saídas</div></div>
      <div class="card kpi"><div class="num" style="font-size:clamp(14px,4.2vw,20px);color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${tsMoeda(saldo)}</div><div class="rot">Saldo do mês</div></div>
    </div>
    ${ts.form ? tsFormHtml() : '<div class="acoes" style="margin-top:6px"><button class="btn btn-pri" id="ts-novo">+ Novo lançamento</button></div>'}
    <h2>Contas fixas do mês</h2>
    <p class="dica" style="margin-top:-4px">Toque em "Lançar" quando pagar. Elas voltam todo mês sozinhas.</p>
    ${tsFixasHtml()}
    <h2>Lançamentos do mês</h2>
    ${razao || '<div class="card vazio">Nenhum lançamento neste mês. Toque em "Novo lançamento" para começar.</div>'}
    ${ts.lanc.length ? `<h2>Fechamento por categoria</h2>
    <div class="card"><div class="sub">Entradas</div>${tsBarras(t.catE, 'var(--green)')}<div class="sub" style="margin-top:10px">Saídas</div>${tsBarras(t.catS, 'var(--red)')}</div>
    <h2>Fechamento por forma de pagamento</h2>
    <div class="card"><div class="sub">Entradas</div>${tsBarras(t.formaE, 'var(--green)')}<div class="sub" style="margin-top:10px">Saídas</div>${tsBarras(t.formaS, 'var(--red)')}</div>
    ${tsDizimosHtml()}
    <div class="acoes"><button class="btn btn-sec" id="ts-copiar">Copiar relatório</button><button class="btn btn-pri" id="ts-pdf">Baixar PDF</button></div>` : ''}`;

  $('#ts-ant').onclick = () => { ts.mes = tsMudaMes(ts.mes, -1); ts.lanc = null; ts.form = null; renderTesouraria(); };
  $('#ts-prox').onclick = () => { ts.mes = tsMudaMes(ts.mes, 1); ts.lanc = null; ts.form = null; renderTesouraria(); };
  if ($('#ts-novo')) $('#ts-novo').onclick = () => { ts.form = { tipo: 'entrada', fixa: false, data: ts.mes === tsHojeIso().slice(0, 7) ? tsHojeIso() : ts.mes + '-01', categoria: 'Ofertas', forma_pagamento: 'Dinheiro' }; renderTesouraria(); $('#tsf-desc').focus(); };
  if ($('#ts-nova-fixa')) $('#ts-nova-fixa').onclick = () => { ts.formFixa = true; renderTesouraria(); $('#tsx-nome').focus(); };
  if ($('#ts-copiar')) $('#ts-copiar').onclick = () => navigator.clipboard.writeText(tsRelatorioTexto()).then(() => toast('Relatório copiado.'), () => toast('Não foi possível copiar.'));
  if ($('#ts-pdf')) $('#ts-pdf').onclick = tsBaixarPdf;
  if (ts.form) tsLigarForm();
  if (ts.formFixa) tsLigarFormFixa();
  el.querySelectorAll('[data-ts-editar]').forEach((c) => (c.onclick = () => {
    const x = ts.lanc.find((l) => l.id === c.dataset.tsEditar); if (!x) return;
    ts.form = { ...x };
    if (!x.membro_id && x.tipo === 'entrada' && x.categoria === 'Dízimos') { const s = tsSugerirMembro(x.descricao); if (s) { ts.form.membro_id = s.id; ts.form.sugerido = true; } }
    renderTesouraria(); $('#ts-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  el.querySelectorAll('[data-ts-lancar-fixa]').forEach((b) => (b.onclick = () => tsLancarFixa(b.dataset.tsLancarFixa)));
  el.querySelectorAll('[data-ts-remover-fixa]').forEach((b) => (b.onclick = async () => {
    const f = ts.fixas.find((x) => x.id === b.dataset.tsRemoverFixa);
    if (!f || !confirm(`Parar de repetir a conta fixa "${f.nome}"? Os lançamentos já feitos continuam.`)) return;
    const { error } = await sb.from('tesouraria_contas_fixas').update({ ativa: false }).eq('id', f.id);
    if (error) return toast('Erro: ' + error.message);
    toast('Conta fixa removida.'); tsCarregar();
  }));
}

function tsLigarForm() {
  const ler = () => {
    const f = ts.form;
    f.tipo = $('#tsf-tipo').value; f.fixa = $('#tsf-fixa').value === '1'; f.descricao = $('#tsf-desc').value.trim();
    f.data = $('#tsf-data').value; f.valor = $('#tsf-valor').value === '' ? null : Number($('#tsf-valor').value);
    f.categoria = $('#tsf-cat').value; f.forma_pagamento = $('#tsf-forma').value;
    const nome = $('#tsf-membro').value.trim();
    const m = nome ? estado.membros.find((p) => p.nome === nome) || estado.membros.find((p) => tsNorm(p.nome) === tsNorm(nome)) : null;
    f.membro_id = f.tipo === 'entrada' && m ? m.id : null; f.membroDigitado = nome;
  };
  $('#tsf-tipo').onchange = () => { ler(); ts.form.categoria = (ts.form.tipo === 'entrada' ? TS_CAT_ENTRADA : TS_CAT_SAIDA)[0]; renderTesouraria(); };
  $('#tsf-cancelar').onclick = () => { ts.form = null; renderTesouraria(); };
  if ($('#tsf-excluir')) $('#tsf-excluir').onclick = async () => {
    const f = ts.form;
    if (!confirm(`Excluir o lançamento "${f.descricao}" de ${tsMoeda(f.valor)}?`)) return;
    const { error } = await sb.from('tesouraria_lancamentos').delete().eq('id', f.id);
    if (error) return toast('Erro ao excluir: ' + error.message);
    ts.form = null; toast('Lançamento excluído.'); tsCarregar();
  };
  $('#tsf-salvar').onclick = async () => {
    ler();
    const f = ts.form;
    if (!f.descricao) return toast('Escreva uma descrição.');
    if (!f.data) return toast('Escolha a data.');
    if (!(f.valor > 0)) return toast('Informe um valor válido.');
    if (f.membroDigitado && f.tipo === 'entrada' && !f.membro_id) return toast('Não achei esse membro. Escolha um nome da lista ou deixe em branco.');
    const linha = { data: f.data, descricao: f.descricao, categoria: f.categoria, tipo: f.tipo, fixa: f.fixa, valor: Math.round(f.valor * 100) / 100, forma_pagamento: f.forma_pagamento, membro_id: f.membro_id };
    const r = f.id ? await sb.from('tesouraria_lancamentos').update(linha).eq('id', f.id)
      : await sb.from('tesouraria_lancamentos').insert({ ...linha, criado_por: estado.email || '' });
    if (r.error) return toast('Não foi possível salvar: ' + r.error.message);
    toast(f.id ? 'Lançamento atualizado.' : 'Lançamento salvo.');
    ts.form = null;
    if (f.data.slice(0, 7) !== ts.mes) ts.mes = f.data.slice(0, 7);
    tsCarregar();
  };
}

function tsLigarFormFixa() {
  $('#tsx-tipo').onchange = () => { $('#tsx-cat').innerHTML = tsOpcoes($('#tsx-tipo').value === 'entrada' ? TS_CAT_ENTRADA : TS_CAT_SAIDA); };
  $('#tsx-cancelar').onclick = () => { ts.formFixa = false; renderTesouraria(); };
  $('#tsx-salvar').onclick = async () => {
    const nome = $('#tsx-nome').value.trim(), dia = parseInt($('#tsx-dia').value, 10), valor = Number($('#tsx-valor').value);
    if (!nome) return toast('Dê um nome para a conta.');
    if (!(dia >= 1 && dia <= 31)) return toast('Informe um dia válido (1 a 31).');
    if (!(valor > 0)) return toast('Informe um valor válido.');
    const { error } = await sb.from('tesouraria_contas_fixas').insert({ nome, dia_vencimento: dia, valor, tipo: $('#tsx-tipo').value, categoria: $('#tsx-cat').value, forma_pagamento: $('#tsx-forma').value });
    if (error) return toast('Não foi possível salvar: ' + error.message);
    ts.formFixa = false; toast('Conta fixa cadastrada.'); tsCarregar();
  };
}

async function tsLancarFixa(id) {
  const f = ts.fixas.find((x) => x.id === id); if (!f) return;
  const hojeIso = tsHojeIso();
  const ultimo = new Date(+ts.mes.slice(0, 4), +ts.mes.slice(5, 7), 0).getDate();
  const data = hojeIso.slice(0, 7) === ts.mes ? hojeIso : `${ts.mes}-${String(Math.min(f.dia_vencimento, ultimo)).padStart(2, '0')}`;
  const { error } = await sb.from('tesouraria_lancamentos').insert({ data, descricao: f.nome, categoria: f.categoria, tipo: f.tipo, fixa: true, valor: f.valor, forma_pagamento: f.forma_pagamento, conta_fixa_id: f.id, criado_por: estado.email || '' });
  if (error) return toast('Não foi possível lançar: ' + error.message);
  toast('Lançamento registrado.'); tsCarregar();
}

function tsOrdenado() { return ts.lanc.slice().sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0)); }

function tsRelatorioTexto() {
  const t = tsTotais(ts.lanc);
  const bloco = (titulo, o) => [`--- ${titulo} ---`, ...(Object.keys(o).length ? Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${tsMoeda(v)}`) : ['(nenhuma)']), ''];
  return ['MINISTÉRIO CRISTÃO SOMOS UM', 'Relatório de caixa — ' + tsMesNome(ts.mes), '',
    'ENTRADAS: ' + tsMoeda(t.e), 'SAÍDAS: ' + tsMoeda(t.s), 'SALDO DO MÊS: ' + tsMoeda(t.e - t.s), '',
    ...bloco('Entradas por categoria', t.catE), ...bloco('Saídas por categoria', t.catS),
    ...bloco('Entradas por forma de pagamento', t.formaE), ...bloco('Saídas por forma de pagamento', t.formaS),
    '--- Lançamentos ---',
    ...tsOrdenado().map((x) => `${tsData(x.data)}  ${x.tipo === 'entrada' ? '+' : '-'}${tsMoeda(x.valor)}  ${x.descricao} (${x.categoria}${x.fixa ? ', fixa' : ', variável'}${x.forma_pagamento ? ', ' + x.forma_pagamento : ''})`)].join('\n');
}

function tsCarregarScript(src) {
  return new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
}
function tsImagem(url) {
  return fetch(url).then((r) => r.blob()).then((b) => new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); })).catch(() => null);
}

async function tsBaixarPdf() {
  try {
    if (!window.jspdf) await tsCarregarScript('lib/jspdf-2.5.1.umd.min.js');
  } catch (e) { return toast('Não foi possível gerar o PDF. Use "Copiar relatório".'); }
  const logo = await tsImagem('img/logo-somos-um.png');
  const t = tsTotais(ts.lanc), saldo = t.e - t.s;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  const mx = 16, W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  let y = 20;
  const espaco = (n) => { if (y + n > H - 16) { doc.addPage(); y = 20; } };
  const titulo = (txt) => { espaco(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#111111'); doc.text(txt, mx, y); y += 7; };
  const texto = (txt, o = {}) => { espaco(6); doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size || 10.5); doc.setTextColor(o.cor || '#1b1b1b'); doc.text(txt, mx, y); y += o.gap ?? 6; };
  const linha = () => { espaco(4); doc.setDrawColor('#dddddd'); doc.line(mx, y, W - mx, y); y += 6; };
  let tx = mx;
  if (logo) { try { doc.addImage(logo, 'PNG', mx, y - 11, 16, 16); tx = mx + 21; } catch (e) { /* sem logo */ } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor('#c4161c'); doc.text('Ministério Cristão Somos Um', tx, y - 3);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor('#555555'); doc.text('Relatório de caixa — ' + tsMesNome(ts.mes), tx, y + 3);
  y += 9; linha();
  texto('Entradas: ' + tsMoeda(t.e), { bold: true, cor: '#1f7a3d' });
  texto('Saídas: ' + tsMoeda(t.s), { bold: true });
  texto('Saldo do mês: ' + tsMoeda(saldo), { bold: true, cor: saldo >= 0 ? '#1f7a3d' : '#c4161c', gap: 9 });
  const secao = (nome, o) => { titulo(nome); const e = Object.entries(o).sort((a, b) => b[1] - a[1]); if (!e.length) texto('Nenhum registro.', { cor: '#777777' }); e.forEach(([k, v]) => texto(`${k}:  ${tsMoeda(v)}`)); y += 3; };
  secao('Entradas por categoria', t.catE); secao('Saídas por categoria', t.catS);
  secao('Entradas por forma de pagamento', t.formaE); secao('Saídas por forma de pagamento', t.formaS);
  titulo('Lançamentos');
  espaco(7); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor('#777777');
  doc.text('Data', mx, y); doc.text('Descrição', mx + 20, y); doc.text('Categoria', mx + 84, y); doc.text('Forma', mx + 124, y); doc.text('Valor', W - mx, y, { align: 'right' });
  y += 5; linha();
  const corta = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  for (const x of tsOrdenado()) {
    espaco(6.5); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#1b1b1b');
    doc.text(tsData(x.data), mx, y); doc.text(corta(x.descricao, 32), mx + 20, y); doc.text(corta(x.categoria, 20), mx + 84, y); doc.text(corta(x.forma_pagamento || '—', 15), mx + 124, y);
    doc.setTextColor(x.tipo === 'entrada' ? '#1f7a3d' : '#1b1b1b'); doc.text((x.tipo === 'entrada' ? '+ ' : '- ') + tsMoeda(x.valor), W - mx, y, { align: 'right' });
    y += 6;
  }
  espaco(14); y += 4; doc.setFontSize(8.5); doc.setTextColor('#777777');
  doc.text('Ministério Cristão Somos Um · Rua Jerônimo Alberti, 204 – Arruda, Colombo – PR · CNPJ 50.959.252/0001-10', mx, y);
  doc.save('relatorio-caixa-' + ts.mes + '.pdf');
}
