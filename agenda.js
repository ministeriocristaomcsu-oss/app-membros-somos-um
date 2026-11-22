// Agenda da igreja: usado pela página pública (agenda.html) e pelo app (index.html).
// Junta três fontes: cultos fixos da semana, eventos com data e os cultos do app de Escalas.
const AG_INSTAGRAM = { url: 'https://www.instagram.com/mcsomosum', arroba: '@mcsomosum' };
const AG_DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MESES_AG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function agDia(iso) { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); }
function agIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
// "19:00", "19h", "19h30", "9h" -> minutos (para ordenar). Sem hora vai para o fim do dia.
function agMinutos(h) { const m = String(h || '').match(/(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?/i); return m ? Number(m[1]) * 60 + Number(m[2] || 0) : 24 * 60; }
// Mostra sempre do mesmo jeito: 19h, 19h30. Texto livre (ex.: "a definir") fica como está.
function agHora(h) {
  const t = String(h || '').trim();
  const m = t.match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?\s*h?$/i);
  if (!m) return t;
  return Number(m[1]) + 'h' + (m[2] && m[2] !== '00' ? m[2] : '');
}
function agNomeSemana(n, semanaDoMes) { return semanaDoMes ? `${semanaDoMes}º ${AG_DIAS_SEMANA[n].replace('-feira', '').toLowerCase()} do mês` : AG_DIAS_SEMANA[n]; }
function agFmtData(d) { return `${AG_DIAS_SEMANA[d.getDay()].replace('-feira', '')}, ${d.getDate()} de ${MESES_AG[d.getMonth()]}`; }

// Lista de compromissos de `inicio` até `dias` dias depois, em ordem.
// itens: linhas da tabela agenda; cultos: [{data, hora, nome}] vindos da escala.
function expandirAgenda(itens, cultos, inicio, dias) {
  const fim = new Date(inicio); fim.setDate(fim.getDate() + dias);
  const lista = [];
  const diasComCulto = new Set();
  for (const c of cultos || []) {
    if (!c.data) continue;
    const d = agDia(c.data);
    if (d < inicio || d >= fim) continue;
    diasComCulto.add(agIso(d));
    lista.push({ data: d, hora: c.hora || '', titulo: c.nome || 'Culto', local: '', descricao: '', origem: 'escala' });
  }
  for (const it of itens || []) {
    if (it.ativo === false) continue;
    if (it.tipo === 'evento') {
      const ini = agDia(it.data), ate = it.data_fim ? agDia(it.data_fim) : ini;
      if (ate < inicio || ini >= fim) continue;
      lista.push({ ...it, data: ini < inicio ? new Date(inicio) : ini, ate: ate > ini ? ate : null, origem: 'evento' });
    } else {
      for (let d = new Date(inicio); d < fim; d.setDate(d.getDate() + 1)) {
        if (d.getDay() !== it.dia_semana) continue;
        if (it.semana_do_mes && Math.ceil(d.getDate() / 7) !== it.semana_do_mes) continue;
        // A escala já tem o culto deste dia (com o nome certo): não repete o culto fixo
        if (it.culto && diasComCulto.has(agIso(d))) continue;
        lista.push({ ...it, data: new Date(d), origem: 'fixo' });
      }
    }
  }
  return lista.sort((a, b) => a.data - b.data || agMinutos(a.hora) - agMinutos(b.hora) || a.titulo.localeCompare(b.titulo));
}

// Texto pronto para colar no WhatsApp
function textoAgendaWhats(lista, titulo) {
  let txt = `📅 *${titulo}*\nMinistério Cristão Somos Um\n`;
  let ultima = '';
  for (const e of lista) {
    const chave = agIso(e.data);
    if (chave !== ultima) { txt += `\n*${agFmtData(e.data)}*\n`; ultima = chave; }
    txt += `• ${e.hora ? agHora(e.hora) + ' · ' : ''}${e.titulo}${e.local ? ' (' + e.local + ')' : ''}\n`;
  }
  return txt + `\nAgenda completa: ${new URL('agenda.html', location.href).href}\nInstagram: ${AG_INSTAGRAM.url}`;
}

// Ícone do Instagram (contorno), para os botões
const ICONE_INSTAGRAM = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>';
