// 退職所得いくら？の問題を作る（ブラウザと node の両方で使う）。
// 中身は、国税庁タックスアンサー No.1420「退職金を受け取ったとき（退職所得）」・No.2732「退職手当等に対する源泉徴収」に書いてあることだけ（［令和8年4月1日現在法令等］。2026-11-17 に読んだ。要点は共有フォルダ games/taishoku-ikura-research.md）。
// 1問は、退職金の額と勤続年数を読んで、課税退職所得金額（退職所得の金額）を選ぶ。正解したら2段目「どの計算？」を選ぶ。
// 答えはコードで計算する：勤続年数（1年未満の端数は1年に切り上げ）→ 退職所得控除額（20年以下 40万円×年数・80万円に満たなければ80万円／20年超 800万円＋70万円×(年数−20)／障害者になったことが直接の原因なら＋100万円）
//   → 一般は (退職金−控除)×1/2、特定役員（役員等勤続年数5年以下）は 1/2 をしない、短期（役員等以外で勤続5年以下）は 300万円を超える部分は 1/2 をしない → 1,000円未満を切り捨て（No.2732 注1）。
// 税額（速算表・102.1％）・申告書を出さないときの20.42％・同じ年に2つ以上の退職金・役員と従業員の期間が重なる場合は扱わない（画面に書く）。
// 乱数 R は呼ぶ回数が毎回同じになるように使う（sort の比較の中では引かない）。
// KINDS の並びは最後に足すだけにする（並べ替え・削除をすると過去の日の問題が変わる）。
(function (root) {
  "use strict";
  const LV = ["やさしい", "ふつう", "むずかしい"];
  const AS_OF = "令和8年4月1日現在法令等";

  // 出典（画面の「なぜ」に出す）
  const SRC = {
    a: ["国税庁 タックスアンサー No.1420 退職金を受け取ったとき（退職所得）", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1420.htm"],
    b: ["国税庁 タックスアンサー No.2732 退職手当等に対する源泉徴収", "https://www.nta.go.jp/taxes/shiraberu/taxanswer/gensen/2732.htm"],
  };
  const MEDIA = { a: "退職金" };

  const MAN = 10000;
  const yearsOf = (y, m) => y + (m > 0 ? 1 : 0); // 1年未満の端数は1年に切り上げ
  const koujoOf = (A, sho) => (A <= 20 ? Math.max(40 * MAN * A, 80 * MAN) : 800 * MAN + 70 * MAN * (A - 20)) + (sho ? 100 * MAN : 0);
  const typeOf = (A, yaku) => (A <= 5 ? (yaku ? "tk" : "tn") : "ip");
  const cut = (yen) => Math.floor(yen / 1000) * 1000;
  // 課税退職所得金額（1,000円未満切り捨て）
  function taxableOf(type, inc, k) {
    const d = inc - k;
    if (d <= 0) return 0;
    if (type === "tk") return cut(d);
    if (type === "tn") return cut(d <= 300 * MAN ? d / 2 : 150 * MAN + (d - 300 * MAN));
    return cut(d / 2);
  }

  // 2段目「どの計算？」
  const GROUPS = {
    ip: { name: "×1/2", sub: "一般の退職金", set: "all" },
    tk: { name: "1/2をしない", sub: "特定役員（役員5年以下）", set: "all" },
    tn: { name: "300万円を超える分は1/2をしない", sub: "短期（役員以外で勤続5年以下）", set: "all" },
    none: { name: "かからない", sub: "退職金が控除額以下", set: "all" },
  };
  const GRP_WHY = {
    ip: "ふつうの退職金は、(退職金−退職所得控除額)×1/2 が退職所得の金額です。1,000円未満は切り捨てます。",
    tk: "役員等として勤めた年数が5年以下の役員の退職金は、退職金−退職所得控除額で、1/2 をしません。",
    tn: "役員以外で勤続5年以下の退職金は、控除後の額のうち300万円を超える部分に 1/2 をしません。",
    none: "退職金が退職所得控除額以下なら、退職所得の金額は0円です。",
  };
  const KEY = {
    ip: "勤続5年を超える人：(退職金−控除)×1/2",
    tk: "役員5年以下：退職金−控除（1/2 なし）",
    tn: "短期：300万円までは1/2、超えた分はそのまま",
    none: "控除額は、20年以下は40万円×年数、20年超は800万円＋70万円×(年数−20)",
  };

  // 種類：[id, 難しさ, 2段目, 場面（＃ が勤続・＄ が退職金）, 役員か, 障害者か, 勤続の年の下限, 上限, 月の下限, 上限, 退職金の下限, 上限, 刻み, ヒント1]
  // 月が0〜0なら、ちょうどの年数。退職金の刻みが1なら1円単位（1,000円未満の切り捨てが出る）。
  const D = [
    ["ip_rei", 0, "ip", "国税庁の例。勤続＃の会社員が退職金＄。", 0, 0, 10, 10, 2, 2, 800 * MAN, 800 * MAN, 1, "2か月の端数は1年に切り上げる。"],
    ["ip_rei2", 0, "ip", "国税庁の例。勤続＃の会社員が退職金＄。", 0, 0, 29, 29, 2, 2, 2300 * MAN, 2300 * MAN, 1, "20年を超える分は、1年70万円。"],
    ["ip_15", 0, "ip", "勤続＃の会社員Aさんが退職金＄。", 0, 0, 10, 20, 0, 0, 1000 * MAN, 2000 * MAN, 10 * MAN, "20年以下の控除は、40万円×年数。"],
    ["ip_30", 0, "ip", "勤続＃の会社員Bさんが退職金＄。", 0, 0, 21, 38, 0, 0, 2200 * MAN, 3500 * MAN, 10 * MAN, "20年超の控除は、800万円＋70万円×(年数−20)。"],
    ["none_short", 0, "none", "勤続＃の会社員Cさんが退職金＄。", 0, 0, 10, 20, 0, 0, 100 * MAN, 400 * MAN, 10 * MAN, "控除額と退職金をくらべる。"],
    ["ip_8", 0, "ip", "勤続＃の会社員Dさんが退職金＄。", 0, 0, 6, 9, 0, 0, 500 * MAN, 900 * MAN, 10 * MAN, "控除は40万円×年数。そのあと1/2。"],
    ["ip_25", 0, "ip", "勤続＃の会社員Eさんが退職金＄。", 0, 0, 25, 25, 0, 0, 1500 * MAN, 2500 * MAN, 10 * MAN, "25年の控除は、800万円＋70万円×5。"],
    ["ip_20", 0, "ip", "勤続＃の会社員Fさんが退職金＄。", 0, 0, 20, 20, 0, 0, 1000 * MAN, 1500 * MAN, 10 * MAN, "20年の控除は、40万円×20。"],
    ["none_long", 0, "none", "勤続＃の会社員Gさんが退職金＄。", 0, 0, 30, 38, 0, 0, 500 * MAN, 1500 * MAN, 10 * MAN, "長く勤めると、控除も大きい。"],
    ["ip_12", 0, "ip", "勤続＃の会社員Hさんが退職金＄。", 0, 0, 12, 12, 0, 0, 600 * MAN, 1200 * MAN, 10 * MAN, "12年の控除は、40万円×12。"],
    ["ip_m", 1, "ip", "勤続＃の会社員Iさんが退職金＄。", 0, 0, 10, 18, 1, 11, 1000 * MAN, 2000 * MAN, 10 * MAN, "1年未満の端数は1年に切り上げる。"],
    ["ip_m30", 1, "ip", "勤続＃の会社員Jさんが退職金＄。", 0, 0, 21, 34, 1, 11, 2600 * MAN, 4000 * MAN, 10 * MAN, "端数を切り上げてから、20年超の式。"],
    ["tn_1", 1, "tn", "勤続＃で辞めた会社員Kさんが退職金＄。", 0, 0, 0, 0, 3, 11, 100 * MAN, 300 * MAN, 10 * MAN, "40万円×1年が80万円に満たないと？"],
    ["tn_low", 1, "tn", "勤続＃で辞めた会社員Lさんが退職金＄。", 0, 0, 3, 5, 0, 0, 250 * MAN, 400 * MAN, 10 * MAN, "勤続5年以下は短期。300万円以下なら？"],
    ["tn_high", 1, "tn", "勤続＃で辞めた会社員Mさんが退職金＄。", 0, 0, 3, 5, 0, 0, 800 * MAN, 1500 * MAN, 10 * MAN, "短期で300万円を超える部分は？"],
    ["tk_5", 1, "tk", "役員として＃勤めたNさんが退職金＄。", 1, 0, 3, 5, 0, 0, 1000 * MAN, 3000 * MAN, 10 * MAN, "役員5年以下は、1/2 をしない。"],
    ["sho", 1, "ip", "障害者になったことが直接の原因で、勤続＃のOさんが退職金＄。", 0, 1, 10, 20, 0, 0, 1200 * MAN, 2500 * MAN, 10 * MAN, "障害者になって退職すると、控除に＋100万円。"],
    ["ip_hasu", 1, "ip", "勤続＃の会社員Pさんが退職金＄。", 0, 0, 10, 20, 0, 0, 1000 * MAN, 2000 * MAN, 1, "1,000円未満の端数は切り捨てる。"],
    ["none_edge", 1, "none", "勤続＃の会社員Qさんが、ちょうど＄の退職金。", 0, 0, 20, 20, 0, 0, 800 * MAN, 800 * MAN, 1, "控除額と同じなら？"],
    ["ip_edge21", 1, "ip", "勤続＃の会社員Rさんが退職金＄。", 0, 0, 20, 20, 1, 1, 1000 * MAN, 1500 * MAN, 10 * MAN, "1か月の端数でも1年に切り上げる。"],
    ["tn_4m", 1, "tn", "勤続＃で辞めた会社員Sさんが退職金＄。", 0, 0, 4, 4, 1, 11, 300 * MAN, 480 * MAN, 10 * MAN, "切り上げると何年？ 5年以下なら短期。"],
    ["none_sho", 1, "none", "障害者になったことが直接の原因で、勤続＃のTさんが退職金＄。", 0, 1, 10, 15, 0, 0, 300 * MAN, 500 * MAN, 10 * MAN, "控除に＋100万円してからくらべる。"],
    ["tn_edge", 2, "tn", "勤続＃で辞めた会社員Uさんが退職金＄。", 0, 0, 5, 5, 0, 0, 500 * MAN, 500 * MAN, 1, "控除後がちょうど300万円なら？"],
    ["tn_edge2", 2, "tn", "勤続＃で辞めた会社員Vさんが退職金＄。", 0, 0, 5, 5, 0, 0, 510 * MAN, 900 * MAN, 10 * MAN, "150万円＋300万円を超えた部分。"],
    ["tk_m", 2, "tk", "役員として＃勤めたWさんが退職金＄。", 1, 0, 4, 4, 1, 11, 1500 * MAN, 4000 * MAN, 10 * MAN, "切り上げて5年以下なら特定役員。"],
    ["tk_vs", 2, "ip", "役員として＃勤めたXさんが退職金＄。", 1, 0, 6, 10, 0, 0, 1500 * MAN, 3000 * MAN, 10 * MAN, "役員でも5年を超えれば？"],
    ["tn_vs", 2, "ip", "勤続＃で辞めた会社員Yさんが退職金＄。", 0, 0, 5, 5, 1, 1, 600 * MAN, 1200 * MAN, 10 * MAN, "5年1か月は、切り上げると何年？"],
    ["ip_big", 2, "ip", "勤続＃の会社員Zさんが退職金＄。", 0, 0, 35, 42, 0, 0, 4000 * MAN, 8000 * MAN, 10 * MAN, "800万円＋70万円×(年数−20)。"],
    ["sho_long", 2, "ip", "障害者になったことが直接の原因で、勤続＃のあさひさんが退職金＄。", 0, 1, 25, 35, 0, 0, 3000 * MAN, 5000 * MAN, 10 * MAN, "20年超の式に＋100万円。"],
    ["tn_sho", 2, "tn", "障害者になったことが直接の原因で、勤続＃のいぶきさんが退職金＄。", 0, 1, 3, 5, 0, 0, 1000 * MAN, 1500 * MAN, 10 * MAN, "＋100万円、そして短期の計算。"],
    ["tn_hasu", 2, "tn", "勤続＃で辞めた会社員うみさんが退職金＄。", 0, 0, 2, 5, 0, 0, 800 * MAN, 1500 * MAN, 1, "短期の計算のあと、1,000円未満を切り捨て。"],
    ["tk_hasu", 2, "tk", "役員として＃勤めたえまさんが退職金＄。", 1, 0, 2, 5, 0, 0, 1000 * MAN, 3000 * MAN, 1, "1/2 をせず、1,000円未満を切り捨て。"],
    ["ip_m2", 2, "ip", "勤続＃の会社員おとさんが退職金＄。", 0, 0, 21, 30, 1, 11, 2500 * MAN, 4000 * MAN, 1, "切り上げ・20年超の式・1/2・切り捨て。"],
    ["tk_low", 2, "tk", "役員として＃勤めたかえでさんが退職金＄。", 1, 0, 1, 1, 0, 0, 100 * MAN, 500 * MAN, 10 * MAN, "40万円×1年が80万円に満たないと？"],
    ["none_tk", 2, "none", "役員として＃勤めたきよさんが退職金＄。", 1, 0, 3, 3, 0, 0, 50 * MAN, 120 * MAN, 10 * MAN, "役員でも、控除額以下なら？"],
  ];

  const yen = (n) => n.toLocaleString("ja-JP") + "円";
  const man = (n) => (n !== 0 && n % MAN === 0 ? `${(n / MAN).toLocaleString("ja-JP")}万円` : yen(n));
  const label = (t) => (t === 0 ? "0円（かからない）" : yen(t));
  const span = (y, m) => (y ? `${y}年` : "") + (m ? `${m}か月` : "");
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  function shuffle(R, a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = ri(R, 0, i); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  function pickN(R, a, n) { return shuffle(R, a).slice(0, n); }

  function maker(id, sent, yaku, sho, ylo, yhi, mlo, mhi, lo, hi, step) {
    return (R) => {
      const y = ri(R, ylo, yhi), m = ri(R, mlo, mhi), inc = lo + ri(R, 0, Math.floor((hi - lo) / step)) * step;
      const A = yearsOf(y, m), k = koujoOf(A, sho), type = typeOf(A, yaku), ans = taxableOf(type, inc, k), grp = ans === 0 ? "none" : type;
      const sentence = sent.replace("＃", span(y, m)).replace("＄", man(inc));
      // 選び肢：端数を切り上げ忘れた・1/2 のし忘れ（またはしすぎ）・短期の300万円を見ない・20年超を40万円で出した・障害者の100万円を足し忘れた・80万円を見ない額から3つ
      const cand = new Set();
      if (m > 0) cand.add(taxableOf(typeOf(y, yaku), inc, koujoOf(y, sho)));
      for (const t of ["ip", "tk", "tn"]) cand.add(taxableOf(t, inc, k));
      if (A > 20) cand.add(taxableOf(type, inc, 40 * MAN * A + (sho ? 100 * MAN : 0)));
      if (A <= 20) cand.add(taxableOf(type, inc, 70 * MAN * A + (sho ? 100 * MAN : 0)));
      if (sho) cand.add(taxableOf(type, inc, k - 100 * MAN));
      if (A === 1) cand.add(taxableOf(type, inc, 40 * MAN));
      cand.add(cut(inc / 2));
      const ok = (v) => Number.isInteger(v) && v >= 0 && v !== ans;
      const wrong0 = [...cand].filter(ok);
      for (const kk of [1, -1, 2, -2, 3, 4, 5, 6]) { if (new Set(wrong0).size >= 3) break; const v = ans ? Math.round((ans * (1 + kk / 10)) / MAN) * MAN : [10, 20, 5, 30, 40, 50, 60, 70][kk + 2] * MAN; if (ok(v) && !wrong0.includes(v)) wrong0.push(v); }
      const wrong = pickN(R, [...new Set(wrong0)].sort((p, q) => p - q), 3);
      const opts = shuffle(R, [ans, ...wrong]).map(label);
      const kTxt = `勤続${A}年の控除は${man(k)}`;
      const full = ans === 0 ? `${sentence} → ${kTxt}。退職金が控除額以下なので0円` : `${sentence} → ${kTxt}。${type === "tk" ? `${man(inc)}−${man(k)}` : type === "tn" && inc - k > 300 * MAN ? `150万円＋(${man(inc)}−300万円−${man(k)})` : `(${man(inc)}−${man(k)})×1/2`}＝${yen(ans)}（1,000円未満は切り捨て）`;
      return { type: "act", q: `${sentence}　課税退職所得金額は？`, opts, ans: label(ans), rev: false, full, amt: inc, y, m, A, yaku: !!yaku, sho: !!sho, koujo: k, taxable: ans, grp, v: `${y}.${m}/${inc}` };
    };
  }
  const KINDS = D.map(([id, lv, grp, sent, yaku, sho, ylo, yhi, mlo, mhi, lo, hi, step, look]) => ({ id, lv, grp, col: "a", sent, yaku, sho, ylo, yhi, mlo, mhi, lo, hi, step, look, src: ["a", "b"], name: GROUPS[grp].name + "：" + sent.replace(/＃/, "○年").replace(/＄/, "○円").slice(0, 22) + "…", key: KEY[grp], why: GRP_WHY[grp], make: maker(id, sent, yaku, sho, ylo, yhi, mlo, mhi, lo, hi, step) }));
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const kindsOf = (lv) => KINDS.filter((k) => k.lv === lv).map((k) => k.id);
  const GRP_OF = Object.fromEntries(KINDS.map((k) => [k.id, k.grp]));
  const groupsOf = (g) => Object.keys(GROUPS).filter((x) => GROUPS[x].set === GROUPS[g].set);

  function seedOf(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function make(tag) {
    const [kind] = String(tag).split("|"), k = BY[kind];
    if (!k) return null;
    const p = k.make(rng(seedOf(tag)), k.lv);
    return { tag, kind, lv: k.lv, name: k.name, look: k.look, key: k.key, why: k.why, grp: k.grp, gwhy: GRP_WHY[k.grp], media: MEDIA[k.col], src: k.src.map((s) => SRC[s]), ...p };
  }
  const keyOf = (P) => `${P.kind}:${P.q}:${P.opts.slice().sort().join("/")}`;

  function dailyTags(date) {
    const R = rng(seedOf("day:" + date)), e = pickN(R, kindsOf(0), 2), n = pickN(R, kindsOf(1), 2), h = pickN(R, kindsOf(2), 1);
    return [...e, ...n, ...h].map((id, i) => `${id}|${date}:d${i}`);
  }
  function hardTags(date) {
    const dh = dailyTags(date)[4].split("|")[0], R = rng(seedOf("hard:" + date)), h = pickN(R, kindsOf(2).filter((x) => x !== dh), 3);
    return h.map((id, i) => `${id}|${date}:h${i}`);
  }

  const TSK = { KINDS, BY, GROUPS, GRP_OF, GRP_WHY, LV, SRC, MEDIA, AS_OF, yearsOf, koujoOf, typeOf, taxableOf, kindsOf, groupsOf, seedOf, rng, make, keyOf, dailyTags, hardTags, pickN };
  if (typeof module !== "undefined" && module.exports) module.exports = TSK; else root.TSK = TSK;
})(typeof self !== "undefined" ? self : this);
