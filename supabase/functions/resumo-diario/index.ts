// Resumo diário de aniversários, bodas e visitantes para contatar, enviado por e-mail (Resend) às 7h.
// Chamado pelo pg_cron. Manda no máximo um e-mail por dia (tabela resumos_enviados),
// então uma chamada repetida não gera e-mails extras.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_URL = "https://crm-ministerio-somos-um.netlify.app";
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Membro = {
  id: string; nome: string; telefone: string; nascimento: string | null; casamento: string | null;
  estado_civil: string; conjuge_id: string | null; conjuge_nome: string; situacao: string; aceita_mensagens: boolean;
};
type Evento = { tipo: "aniversario" | "casamento"; data: Date; membro: Membro; conjuge?: Membro; quantos: number };

const partes = (iso: string) => { const [a, m, d] = iso.split("-").map(Number); return { a, m, d }; };
const bissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
function dataNoAno(iso: string, ano: number) {
  const p = partes(iso);
  return new Date(Date.UTC(ano, p.m - 1, p.m === 2 && p.d === 29 && !bissexto(ano) ? 28 : p.d));
}
function proximaData(iso: string, base: Date) {
  let d = dataNoAno(iso, base.getUTCFullYear());
  if (d < base) d = dataNoAno(iso, base.getUTCFullYear() + 1);
  return d;
}
function hojeSaoPaulo() {
  const s = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const p = partes(s);
  return new Date(Date.UTC(p.a, p.m - 1, p.d));
}
const primeiroNome = (n: string) => (n || "").trim().split(/\s+/)[0];
function telefoneWa(tel: string) {
  let n = String(tel || "").replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n.length >= 12 ? n : "";
}
const esc = (t: unknown) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Mesma regra do app: casal vinculado aparece uma vez só
function eventosEntre(membros: Membro[], inicio: Date, dias: number): Evento[] {
  const fim = new Date(inicio); fim.setUTCDate(fim.getUTCDate() + dias);
  const porId = Object.fromEntries(membros.map((m) => [m.id, m]));
  const lista: Evento[] = [];
  for (const m of membros) {
    if (m.situacao !== "ativo") continue;
    if (m.nascimento) {
      const d = proximaData(m.nascimento, inicio);
      if (d < fim) lista.push({ tipo: "aniversario", data: d, membro: m, quantos: d.getUTCFullYear() - partes(m.nascimento).a });
    }
    if (m.casamento && ["casado", "uniao_estavel"].includes(m.estado_civil)) {
      const conj = m.conjuge_id ? porId[m.conjuge_id] : undefined;
      if (conj && conj.casamento === m.casamento && conj.situacao === "ativo" && conj.id < m.id) continue;
      const d = proximaData(m.casamento, inicio);
      if (d < fim) lista.push({ tipo: "casamento", data: d, membro: m, conjuge: conj, quantos: d.getUTCFullYear() - partes(m.casamento).a });
    }
  }
  return lista.sort((a, b) => +a.data - +b.data || a.membro.nome.localeCompare(b.membro.nome));
}
// Régua de visitantes: mesmas etapas do app (dias contados da primeira visita)
const ETAPAS = [
  { id: "d0", dias: 0, nome: "Agradecimento pela visita" },
  { id: "d3", dias: 3, nome: "Convite para voltar" },
  { id: "d7", dias: 7, nome: "Oração" },
  { id: "d15", dias: 15, nome: "Convite para um café" },
  { id: "d30", dias: 30, nome: "Contato pessoal (ligar ou visitar)" },
];
type Visitante = { id: string; nome: string; telefone: string; primeira_visita: string; situacao: string; aceita_mensagens: boolean; quer_contato_pastor: boolean; responsavel: string };
type Pendente = { v: Visitante; etapa: typeof ETAPAS[number]; data: Date };
function visitantesPendentes(visitantes: Visitante[], contatos: { visitante_id: string; etapa: string }[], hoje: Date): Pendente[] {
  const feitas = new Set(contatos.map((c) => c.visitante_id + "|" + c.etapa));
  const lista: Pendente[] = [];
  for (const v of visitantes) {
    if (!["novo", "acompanhando"].includes(v.situacao)) continue;
    const etapa = ETAPAS.find((e) => !feitas.has(v.id + "|" + e.id));
    if (!etapa) continue;
    const p = partes(v.primeira_visita);
    const data = new Date(Date.UTC(p.a, p.m - 1, p.d + etapa.dias));
    if (data <= hoje) lista.push({ v, etapa, data });
  }
  return lista.sort((a, b) => +a.data - +b.data || a.v.nome.localeCompare(b.v.nome));
}

function nomeEvento(ev: Evento) {
  if (ev.tipo === "casamento") {
    const outro = ev.conjuge ? ev.conjuge.nome : ev.membro.conjuge_nome;
    return outro ? `${primeiroNome(ev.membro.nome)} e ${primeiroNome(outro)}` : primeiroNome(ev.membro.nome);
  }
  return primeiroNome(ev.membro.nome);
}

Deno.serve(async () => {
  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) return Response.json({ ok: false, motivo: "RESEND_API_KEY não configurada" });
  const para = (Deno.env.get("RESUMO_PARA") || "polako.danesi@gmail.com").split(",").map((s) => s.trim());

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const hoje = hojeSaoPaulo();
  const dia = hoje.toISOString().slice(0, 10);

  const [{ data: membros, error: e1 }, { data: modelos, error: e2 }, { data: visitantes, error: e3 }, { data: contatos, error: e4 }] = await Promise.all([
    sb.from("membros").select("id,nome,telefone,nascimento,casamento,estado_civil,conjuge_id,conjuge_nome,situacao,aceita_mensagens"),
    sb.from("config_mensagens").select("tipo,texto"),
    sb.from("visitantes").select("id,nome,telefone,primeira_visita,situacao,aceita_mensagens,quer_contato_pastor,responsavel").in("situacao", ["novo", "acompanhando"]),
    sb.from("visitantes_contatos").select("visitante_id,etapa").neq("etapa", "avulso"),
  ]);
  const erroBusca = e1 || e2 || e3 || e4;
  if (erroBusca) return Response.json({ ok: false, erro: erroBusca.message }, { status: 500 });

  const deHoje = eventosEntre(membros as Membro[], hoje, 1);
  const visitas = visitantesPendentes(visitantes as Visitante[], contatos || [], hoje);
  if (!deHoje.length && !visitas.length) return Response.json({ ok: true, enviado: false, motivo: "nada para hoje" });

  // Trava de um e-mail por dia
  const { error: trava } = await sb.from("resumos_enviados").insert({ dia, quantidade: deHoje.length + visitas.length });
  if (trava) return Response.json({ ok: true, enviado: false, motivo: "resumo de hoje já enviado" });

  const textos = Object.fromEntries((modelos || []).map((x) => [x.tipo, x.texto]));
  const amanha = new Date(hoje); amanha.setUTCDate(amanha.getUTCDate() + 1);
  const semana = eventosEntre(membros as Membro[], amanha, 6);

  const linhaHoje = (ev: Evento) => {
    const texto = (textos[ev.tipo] || "").replaceAll("{nome}", nomeEvento(ev)).replaceAll("{idade}", String(ev.quantos)).replaceAll("{anos}", String(ev.quantos));
    const pessoas = [ev.membro, ev.conjuge].filter((p): p is Membro => !!p && p.aceita_mensagens !== false && !!telefoneWa(p.telefone));
    const botoes = pessoas.map((p) =>
      `<a href="https://wa.me/${telefoneWa(p.telefone)}?text=${encodeURIComponent(texto)}" style="display:inline-block;background:#1fa855;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600;margin:4px 6px 0 0">WhatsApp ${pessoas.length > 1 ? esc(primeiroNome(p.nome)) : ""}</a>`).join("");
    const titulo = ev.tipo === "casamento" ? `💍 ${esc(nomeEvento(ev))} · ${ev.quantos} anos de casados` : `🎂 ${esc(ev.membro.nome)} · ${ev.quantos} anos`;
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee"><div style="font-weight:600">${titulo}</div>${botoes || '<div style="color:#888;font-size:13px">sem WhatsApp cadastrado</div>'}</td></tr>`;
  };
  const linhaSemana = (ev: Evento) =>
    `<li>${ev.data.getUTCDate()}/${ev.data.getUTCMonth() + 1} · ${ev.tipo === "casamento" ? "💍 " + esc(nomeEvento(ev)) + ` (${ev.quantos} anos de casados)` : "🎂 " + esc(ev.membro.nome)}</li>`;

  const linhaVisitante = ({ v, etapa, data }: Pendente) => {
    const texto = (textos["visitante_" + etapa.id] || "").replaceAll("{nome}", primeiroNome(v.nome));
    const atraso = Math.round((+hoje - +data) / 86400000);
    const botao = v.aceita_mensagens !== false && telefoneWa(v.telefone)
      ? `<a href="https://wa.me/${telefoneWa(v.telefone)}?text=${encodeURIComponent(texto)}" style="display:inline-block;background:#1fa855;color:#fff;text-decoration:none;padding:8px 14px;border-radius:8px;font-weight:600;margin:4px 6px 0 0">WhatsApp</a>`
      : `<div style="color:#888;font-size:13px">${v.aceita_mensagens === false ? "não quer mensagens: falar pessoalmente" : "sem WhatsApp cadastrado"}</div>`;
    const extras = [atraso > 0 ? `${atraso} ${atraso === 1 ? "dia" : "dias"} de atraso` : "", v.quer_contato_pastor ? "quer conversar com o pastor" : "", v.responsavel ? "responsável: " + esc(v.responsavel) : ""].filter(Boolean).join(" · ");
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee"><div style="font-weight:600">🙋 ${esc(v.nome)} · ${esc(etapa.nome)}</div>${extras ? `<div style="color:#666;font-size:13px">${extras}</div>` : ""}${botao}</td></tr>`;
  };

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;color:#1b1b1b">
    <div style="color:#666;margin-bottom:12px">${hoje.getUTCDate()} de ${MESES[hoje.getUTCMonth()]} · Ministério Cristão Somos Um</div>
    ${deHoje.length ? `<h2 style="margin:0 0 4px">Aniversariantes de hoje</h2>
    <table style="width:100%;border-collapse:collapse">${deHoje.map(linhaHoje).join("")}</table>` : ""}
    ${visitas.length ? `<h2 style="margin:${deHoje.length ? "20px" : "0"} 0 4px">Visitantes para contatar</h2>
    <table style="width:100%;border-collapse:collapse">${visitas.map(linhaVisitante).join("")}</table>` : ""}
    <p style="font-size:13px;color:#666">Toque no botão verde: o WhatsApp abre com a mensagem pronta. Depois marque como enviado no <a href="${APP_URL}">app</a>.</p>
    ${semana.length ? `<h3 style="margin:20px 0 6px">Próximos dias</h3><ul style="padding-left:18px;margin:0">${semana.map(linhaSemana).join("")}</ul>` : ""}
  </div>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Somos Um <onboarding@resend.dev>",
      to: para,
      subject: [
        deHoje.length ? `🎉 ${deHoje.length} ${deHoje.length === 1 ? "aniversário" : "aniversários"} hoje: ${deHoje.map(nomeEvento).join(", ")}` : "",
        visitas.length ? `🙋 ${visitas.length} ${visitas.length === 1 ? "visitante" : "visitantes"} para contatar` : "",
      ].filter(Boolean).join(" · "),
      html,
    }),
  });
  if (!r.ok) {
    await sb.from("resumos_enviados").delete().eq("dia", dia); // libera para tentar de novo
    return Response.json({ ok: false, erro: await r.text() }, { status: 502 });
  }
  return Response.json({ ok: true, enviado: true, aniversarios: deHoje.length, visitantes: visitas.length });
});
