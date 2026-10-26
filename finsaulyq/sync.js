"use strict";
/* Бұлтқа синхрондау. Жергілікті күй (S) — жұмыс көшірмесі (офлайн жұмыс істейді), Supabase `items` — негіз.
   Өзгеріс кезекке (S.pending) түседі; желі мен Hub-қа кіру болғанда: алдымен жіберу, сосын серверді оқып біріктіру.
   Ереже: соңғы жіберілген өзгеріс жеңеді (жалғыз қолданушы). Кіру — Hub-пен ортақ сессия (бір домен). */
const SB_URL = "https://lcmnkcpkbkrktediyvpo.supabase.co", SB_KEY = "sb_publishable_Z0BZxemzhkUPo_lfgxMAbA_9TkVXL2q";
const Sync = { sb: null, busy: false, state: "local", error: "", timer: 0 }; // state: local | ok | wait | err
try { Sync.sb = supabase.createClient(SB_URL, SB_KEY); } catch { /* кітапхана жүктелмеді — тек жергілікті режим */ }

Sync.schedule = () => { clearTimeout(Sync.timer); Sync.timer = setTimeout(Sync.now, 1000); };

async function pullRows() {
  const rows = [], apps = Object.values(FS.APP_OF);
  for (let a = 0; ; a += 1000) { // PostgREST бір жауапта 1000 жолдан аспайды
    const { data, error } = await Sync.sb.from("items").select("id, app, data, created_at").in("app", apps).order("created_at", { ascending: false }).order("id").range(a, a + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

Sync.now = async () => {
  if (Sync.busy || !Sync.sb || !navigator.onLine) return;
  Sync.busy = true;
  try {
    const { data: { session } } = await Sync.sb.auth.getSession();
    if (!session) { Sync.state = "local"; return; }
    if (!S.synced) { // алғашқы рет: жергілікті деректер серверге қосылады (бар жазбалар өшпейді)
      const rows = await pullRows(), have = new Set(rows.map((r) => r.id));
      for (const k of LISTS) for (const e of S[k]) if (!have.has(e.id)) queue(k, e.id, "put");
      if (!rows.some((r) => r.app === "fs_settings")) put("settings"); // серверде баптау болса, соны аламыз
      S.synced = true; persist();
    }
    for (const p of [...S.pending]) {
      const e = p.k === "settings" ? S.settings : S[p.k].find((x) => x.id === p.id);
      if (p.op === "put" && !e) { S.pending = S.pending.filter((x) => x.n !== p.n); continue; }
      const { error } = p.op === "del" ? await Sync.sb.from("items").delete().eq("id", p.id) : await Sync.sb.from("items").upsert(FS.toRow(p.k, e, S.settingsId));
      if (error) throw error;
      S.pending = S.pending.filter((x) => x.n !== p.n); // өзгеріс жіберу кезінде жаңарса, жаңа жазба (басқа n) кезекте қалады
      persist();
    }
    Object.assign(S, FS.mergePull(S, await pullRows()));
    migrate();
    Sync.state = S.pending.length ? "wait" : "ok"; Sync.error = "";
    persist();
  } catch (e) {
    Sync.state = "err"; Sync.error = e?.message || String(e);
  } finally {
    Sync.busy = false;
    render();
    if (S.pending.length && Sync.state !== "err") Sync.schedule(); // жіберу кезінде жаңа өзгеріс түсті
  }
};

Sync.start = () => {
  Sync.now();
  addEventListener("online", Sync.now);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) Sync.now(); });
  Sync.sb?.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") Sync.now(); });
};
