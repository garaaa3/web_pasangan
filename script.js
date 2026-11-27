// Kunci publik ini aman dipasang di kode web. Jangan pernah memasang kunci "secret".
const SUPABASE_URL = "https://dcrrrcrbmhghhxbfkzjt.supabase.co";
const SUPABASE_KEY = "sb_publishable_Vqoso42wOQfVImHGMUupew_yESc1nN3";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const MAXN = 10,
  MAXVID = 45 * 1024 * 1024;
const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const ICONS = { impian: "🎯", jadwal: "🗓", ultah: "🎂" };
let uid = null,
  cid = null,
  names = {},
  startDate = null;
let allPosts = [],
  urlMap = {},
  curPT = "foto";
let sel = [],
  cur = 0;
let wishes = [],
  events = [];
let calY = new Date().getFullYear(),
  calM = new Date().getMonth(),
  selDate = ymd(new Date());

function ymd(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function show(v) {
  ["vAuth", "vSetup", "vApp"].forEach((x) =>
    $(x).classList.toggle("hidden", x !== v),
  );
  $("nav").classList.toggle("hidden", v !== "vApp");
  if (v !== "vApp") {
    closeViewer();
    $("siteTitle").textContent = "Kita Berdua";
    document.title = "Kita Berdua";
  }
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : s;
  return d.innerHTML.replace(/"/g, "&quot;");
}
function fmt(d) {
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tab(t) {
  if ($("tabPeta")) $("tabPeta").classList.toggle("hidden", t !== "peta");
  if (t === "peta" && typeof openMap === "function") openMap();
  else if (typeof stopMapView === "function") stopMapView();
  $("tabBeranda").classList.toggle("hidden", t !== "beranda");
  $("tabImpian").classList.toggle("hidden", t !== "impian");
  $("tabTambah").classList.toggle("hidden", t !== "tambah");
  $("tabTabungan").classList.toggle("hidden", t !== "tabungan");
  if (t === "tabungan") loadSavings();
  document
    .querySelectorAll("#nav button")
    .forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
  if (t === "impian") {
    loadWishes();
    loadEvents();
  }
  window.scrollTo(0, 0);
}
document
  .querySelectorAll("#nav button")
  .forEach((b) => (b.onclick = () => tab(b.dataset.tab)));

// ---------- Rute ----------
async function route() {
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) {
    uid = null;
    return show("vAuth");
  }
  uid = session.user.id;
  const { data: m } = await sb
    .from("members")
    .select("couple_id")
    .eq("user_id", uid)
    .maybeSingle();
  if (!m) {
    return show("vSetup");
  }
  cid = m.couple_id;
  show("vApp");
  await loadApp();
}
sb.auth.onAuthStateChange(() => {
  route();
});

// ---------- Masuk / daftar ----------
$("bLogin").onclick = async () => {
  $("mAuth").textContent = "";
  const { error } = await sb.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("pass").value,
  });
  if (error) $("mAuth").textContent = "Gagal masuk: " + error.message;
};
$("bSignup").onclick = async () => {
  $("mAuth").textContent = "";
  const { data, error } = await sb.auth.signUp({
    email: $("email").value.trim(),
    password: $("pass").value,
  });
  if (error) $("mAuth").textContent = "Gagal daftar: " + error.message;
  else if (!data.session)
    $("mAuth").textContent =
      "Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.";
};
async function logout() {
  try {
    await stopShare(true);
  } catch (e) {}
  await sb.auth.signOut();
}
$("bOut1").onclick = logout;
$("bOut2").onclick = logout;

// ---------- Buat / gabung pasangan ----------
$("bCreate").onclick = async () => {
  const n = $("cName").value.trim(),
    me = $("myName1").value.trim();
  if (!n || !me) {
    $("mSetup").textContent = "Isi nama ruang dan namamu dulu.";
    return;
  }
  const { error } = await sb.rpc("create_couple", {
    couple_name: n,
    my_name: me,
  });
  if (error) $("mSetup").textContent = error.message;
  else route();
};
$("bJoin").onclick = async () => {
  const c = $("code").value.trim(),
    me = $("myName2").value.trim();
  if (!c || !me) {
    $("mSetup").textContent = "Isi kode undangan dan namamu dulu.";
    return;
  }
  const { error } = await sb.rpc("join_couple", { code: c, my_name: me });
  if (error) $("mSetup").textContent = error.message;
  else route();
};

// ---------- Memuat data ----------
async function loadApp() {
  $("pDate").value = new Date().toISOString().slice(0, 10);
  const { data: c } = await sb
    .from("couples")
    .select("name,invite_code,start_date")
    .eq("id", cid)
    .single();
  if (c) {
    $("cTitle").textContent = c.name;
    $("cCode").textContent = c.invite_code;
    $("siteTitle").textContent = c.name;
    document.title = c.name;
    startDate = c.start_date || null;
  }
  const { data: ms } = await sb
    .from("members")
    .select("user_id,display_name")
    .eq("couple_id", cid);
  names = {};
  (ms || []).forEach((m) => (names[m.user_id] = m.display_name));
  const me = (ms || []).find((m) => m.user_id === uid),
    other = (ms || []).find((m) => m.user_id !== uid);
  $("nA").textContent = me ? me.display_name : "Kamu";
  $("nB").textContent = other ? other.display_name : "Menunggu pasangan...";
  $("eMe").value = me ? me.display_name : "";
  $("eDate").value = startDate || "";
  maybeOnboard();
  loadActivity();
  subscribeActivity();
  tick();
  await loadFeed();
}

function tick() {
  if (!startDate) {
    $("kClock").style.display = "none";
    $("since").textContent =
      "Belum ada tanggal jadian. Isi lewat Ubah nama dan tanggal jadian.";
    $("next").textContent = "";
    return;
  }
  $("kClock").style.display = "";
  $("since").textContent = "Bersama sejak " + fmt(startDate);
  const st = new Date(startDate + "T00:00:00"),
    now = new Date();
  const s = Math.max(0, Math.floor((now - st) / 1000));
  $("kD").textContent = Math.floor(s / 86400);
  $("kH").textContent = Math.floor((s % 86400) / 3600);
  $("kM").textContent = Math.floor((s % 3600) / 60);
  $("kS").textContent = s % 60;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const nx = new Date(now.getFullYear(), st.getMonth(), st.getDate());
  if (nx < today) nx.setFullYear(nx.getFullYear() + 1);
  const left = Math.round((nx - today) / 86400000),
    yrs = nx.getFullYear() - st.getFullYear();
  $("next").textContent =
    left === 0
      ? "Selamat hari jadi ke-" + yrs + "!"
      : left + " hari lagi menuju hari jadi ke-" + yrs + " tahun";
}
setInterval(tick, 1000);

// ---------- Data postingan ----------
function mediaOf(p) {
  if (p.media && p.media.length) return p.media;
  const ps =
    p.image_paths && p.image_paths.length ? p.image_paths : [p.image_path];
  return ps.map((x) => ({ p: x, t: "i" }));
}
function ratioOf(m) {
  return m.w && m.h ? Math.min(2, Math.max(0.6, m.w / m.h)) : 0.8;
}
function fit(el) {
  const s = el.closest(".slider");
  if (!s || !el.naturalWidth) return;
  s.style.aspectRatio = Math.min(
    2,
    Math.max(0.6, el.naturalWidth / el.naturalHeight),
  );
}
function listFor(pt) {
  return allPosts.filter((p) =>
    mediaOf(p).some((m) => (pt === "video" ? m.t === "v" : m.t !== "v")),
  );
}

async function loadFeed() {
  const { data: posts, error } = await sb
    .from("posts")
    .select("id,author_id,title,post_date,caption,image_path,image_paths,media")
    .eq("couple_id", cid)
    .order("post_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    $("pgrid").innerHTML =
      '<p class="msg" style="grid-column:1/-1">' + esc(error.message) + "</p>";
    return;
  }
  allPosts = posts;
  const all = [];
  posts.forEach((p) => mediaOf(p).forEach((m) => all.push(m.p)));
  urlMap = {};
  if (all.length) {
    const { data: urls } = await sb.storage
      .from("photos")
      .createSignedUrls(all, 3600);
    (urls || []).forEach((x) => (urlMap[x.path] = x.signedUrl));
  }
  renderGrid();
}

// ---------- Kotak-kotak (Foto / Video) ----------
function renderGrid() {
  document
    .querySelectorAll(".ptabs button")
    .forEach((b) => b.classList.toggle("on", b.dataset.pt === curPT));
  const list = listFor(curPT);
  if (!list.length) {
    $("pgrid").innerHTML =
      '<p class="empty" style="grid-column:1/-1">' +
      (curPT === "video"
        ? "Belum ada video. Ketuk + Tambah untuk mengunggah."
        : "Belum ada foto. Ketuk + Tambah untuk mengunggah kenangan pertama kalian.") +
      "</p>";
    return;
  }
  $("pgrid").innerHTML = list
    .map((p) => {
      const ms = mediaOf(p);
      const k = ms.findIndex((m) =>
        curPT === "video" ? m.t === "v" : m.t !== "v",
      );
      const m = ms[k],
        src = esc(urlMap[m.p] || "");
      const thumb =
        m.t === "v"
          ? '<video src="' +
            src +
            '#t=0.1" muted playsinline preload="metadata"></video>'
          : '<img loading="lazy" src="' + src + '" alt="">';
      const badge = curPT === "video" ? "▶" : ms.length > 1 ? "⧉" : "";
      return (
        '<button class="tile" data-id="' +
        p.id +
        '" data-k="' +
        k +
        '" aria-label="' +
        esc(p.title) +
        '">' +
        thumb +
        (badge ? '<span class="bd">' + badge + "</span>" : "") +
        "</button>"
      );
    })
    .join("");
}
document.querySelectorAll(".ptabs button").forEach(
  (b) =>
    (b.onclick = () => {
      curPT = b.dataset.pt;
      renderGrid();
    }),
);
$("pgrid").onclick = (e) => {
  const t = e.target.closest(".tile");
  if (t) openViewer(t.dataset.id, +t.dataset.k);
};

// ---------- Layar postingan penuh ----------
function articleHTML(p) {
  const ms = mediaOf(p),
    many = ms.length > 1,
    r = ratioOf(ms[0]);
  const items = ms
    .map((m, i) => {
      const src = esc(urlMap[m.p] || "");
      if (m.t === "v")
        return (
          '<video class="m" src="' +
          src +
          '#t=0.1" controls playsinline preload="metadata"></video>'
        );
      return (
        '<img class="m" loading="lazy" src="' +
        src +
        '" alt="' +
        esc(p.title) +
        " " +
        (i + 1) +
        '"' +
        (i === 0 && !ms[0].w ? ' onload="fit(this)"' : "") +
        ">"
      );
    })
    .join("");
  return (
    '<article class="post" data-pid="' +
    p.id +
    '"><h3>' +
    esc(p.title) +
    "</h3>" +
    "<time>" +
    fmt(p.post_date) +
    " · " +
    esc(names[p.author_id] || "Pasangan") +
    "</time>" +
    '<div class="slider" style="aspect-ratio:' +
    r +
    '"><div class="track">' +
    items +
    "</div>" +
    (many
      ? '<span class="count">1/' +
        ms.length +
        "</span>" +
        '<button class="arrow l" data-nav="prev" aria-label="Sebelumnya">‹</button>' +
        '<button class="arrow r" data-nav="next" aria-label="Berikutnya">›</button>'
      : "") +
    "</div>" +
    (many
      ? '<div class="dots">' +
        ms
          .map(
            (_, i) => '<span class="dot' + (i === 0 ? " on" : "") + '"></span>',
          )
          .join("") +
        "</div>"
      : "") +
    (p.caption ? "<p>" + esc(p.caption) + "</p>" : "") +
    (p.author_id === uid
      ? '<button class="link" data-editpost="' +
        p.id +
        '">Ubah judul dan cerita</button> <button class="link" data-delpost="' +
        p.id +
        '">Hapus postingan</button>'
      : "") +
    "</article>"
  );
}

function openViewer(id, idx) {
  $("vList").innerHTML = listFor(curPT).map(articleHTML).join("");
  $("viewer").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  const art = $("vList").querySelector('[data-pid="' + id + '"]');
  if (art) {
    art.scrollIntoView({ block: "start" });
    const tr = art.querySelector(".track");
    if (tr && idx > 0) {
      requestAnimationFrame(() => {
        tr.scrollLeft = idx * tr.clientWidth;
      });
    }
  }
}
function closeViewer() {
  $("vList").innerHTML = "";
  $("viewer").classList.add("hidden");
  document.body.style.overflow = "";
}
$("vBack").onclick = closeViewer;

$("vList").addEventListener(
  "scroll",
  (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("track")) return;
    const i = Math.round(t.scrollLeft / t.clientWidth),
      art = t.closest(".post");
    const c = art.querySelector(".count");
    if (c) c.textContent = i + 1 + "/" + t.children.length;
    art
      .querySelectorAll(".dot")
      .forEach((d, k) => d.classList.toggle("on", k === i));
    Array.from(t.children).forEach((el, k) => {
      if (k !== i && el.tagName === "VIDEO") el.pause();
    });
  },
  true,
);

$("vList").onclick = async (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.nav) {
    const tr = t.closest(".slider").querySelector(".track");
    tr.scrollBy({
      left: (t.dataset.nav === "next" ? 1 : -1) * tr.clientWidth,
      behavior: "smooth",
    });
  } else if (t.dataset.editpost) {
    const p = allPosts.find((x) => x.id === t.dataset.editpost);
    if (!p) return;
    const nt = prompt("Judul baru:", p.title);
    if (nt === null) return;
    if (!nt.trim()) {
      alert("Judul tidak boleh kosong.");
      return;
    }
    const nc = prompt(
      "Cerita baru (kosongkan untuk menghapus cerita):",
      p.caption || "",
    );
    if (nc === null) return;
    const { error } = await sb
      .from("posts")
      .update({ title: nt.trim(), caption: nc.trim() || null })
      .eq("id", p.id);
    if (error) {
      alert("Gagal menyimpan: " + error.message);
      return;
    }
    const y = $("viewer").scrollTop;
    await loadFeed();
    $("vList").innerHTML = listFor(curPT).map(articleHTML).join("");
    $("viewer").scrollTop = y;
  } else if (t.dataset.delpost) {
    const p = allPosts.find((x) => x.id === t.dataset.delpost);
    if (!p || !confirm("Hapus postingan ini beserta semua foto dan videonya?"))
      return;
    await sb.storage.from("photos").remove(mediaOf(p).map((m) => m.p));
    await sb.from("posts").delete().eq("id", p.id);
    closeViewer();
    loadFeed();
  }
};

// ---------- Ubah nama ruang / nama / tanggal jadian ----------
$("bRename").onclick = async () => {
  const n = prompt("Nama ruang baru:", $("cTitle").textContent);
  if (!n || !n.trim()) return;
  const { error } = await sb
    .from("couples")
    .update({ name: n.trim() })
    .eq("id", cid);
  if (error) alert("Gagal mengubah nama: " + error.message);
  else loadApp();
};
$("bSaveInfo").onclick = async () => {
  $("mInfo").textContent = "";
  const n = $("eMe").value.trim(),
    d = $("eDate").value || null;
  if (!n) {
    $("mInfo").textContent = "Nama tidak boleh kosong.";
    return;
  }
  const r1 = await sb
    .from("members")
    .update({ display_name: n })
    .eq("couple_id", cid)
    .eq("user_id", uid);
  if (r1.error) {
    $("mInfo").textContent = "Gagal menyimpan nama: " + r1.error.message;
    return;
  }
  const r2 = await sb.from("couples").update({ start_date: d }).eq("id", cid);
  if (r2.error) {
    $("mInfo").textContent = "Gagal menyimpan tanggal: " + r2.error.message;
    return;
  }
  $("mInfo").textContent = "Tersimpan.";
  await loadApp();
};

// ---------- Impian ----------
async function loadWishes() {
  const { data, error } = await sb
    .from("wishes")
    .select("id,author_id,title,done,done_at,created_at")
    .eq("couple_id", cid)
    .order("created_at", { ascending: false });
  if (error) {
    $("wList").innerHTML = '<p class="msg">' + esc(error.message) + "</p>";
    return;
  }
  wishes = data;
  renderWishes();
  fillWishSelect();
}

function wishRow(w) {
  return (
    '<div class="wish' +
    (w.done ? " done" : "") +
    '"><div class="wt"><span>' +
    esc(w.title) +
    "</span><small>" +
    esc(names[w.author_id] || "Pasangan") +
    (w.done && w.done_at ? " · terwujud " + fmt(w.done_at.slice(0, 10)) : "") +
    "</small></div>" +
    '<button class="link" data-wt="' +
    w.id +
    '">' +
    (w.done ? "Batal terwujud" : "Terwujud") +
    "</button>" +
    '<button class="link" data-wedit="' +
    w.id +
    '">Ubah</button>' +
    '<button class="link" data-wdel="' +
    w.id +
    '">Hapus</button></div>'
  );
}

function renderWishes() {
  const todo = wishes.filter((w) => !w.done),
    dn = wishes.filter((w) => w.done);
  $("wCount").textContent = wishes.length
    ? dn.length + " dari " + wishes.length + " impian sudah terwujud"
    : "";
  if (!wishes.length) {
    $("wList").innerHTML =
      '<p class="empty">Belum ada impian. Ketuk + Tambah impian di atas.</p>';
    return;
  }
  $("wList").innerHTML =
    (todo.length
      ? '<div class="wh">Belum terwujud</div>' + todo.map(wishRow).join("")
      : "") +
    (dn.length
      ? '<div class="wh">Sudah terwujud</div>' + dn.map(wishRow).join("")
      : "");
}

async function addWish() {
  const t = $("wTitle").value.trim();
  $("mWish").textContent = "";
  if (!t) {
    $("mWish").textContent = "Tulis impiannya dulu.";
    return;
  }
  const { error } = await sb
    .from("wishes")
    .insert({ couple_id: cid, title: t });
  if (error) {
    $("mWish").textContent = "Gagal menambah: " + error.message;
    return;
  }
  $("wTitle").value = "";
  $("wForm").classList.add("hidden");
  loadWishes();
}
$("bShowWish").onclick = () => {
  $("wForm").classList.toggle("hidden");
  if (!$("wForm").classList.contains("hidden")) $("wTitle").focus();
};
$("bCancelWish").onclick = () => {
  $("wTitle").value = "";
  $("mWish").textContent = "";
  $("wForm").classList.add("hidden");
};
$("bWish").onclick = addWish;
$("wTitle").addEventListener("keydown", (e) => {
  if (e.key === "Enter") addWish();
});

$("wList").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.wt) {
    const w = wishes.find((x) => x.id === b.dataset.wt);
    if (!w) return;
    const { error } = await sb
      .from("wishes")
      .update({
        done: !w.done,
        done_at: !w.done ? new Date().toISOString() : null,
      })
      .eq("id", w.id);
    if (error) alert("Gagal menyimpan: " + error.message);
    else loadWishes();
  } else if (b.dataset.wedit) {
    const w = wishes.find((x) => x.id === b.dataset.wedit);
    if (!w) return;
    const t = prompt("Ubah impian:", w.title);
    if (t === null) return;
    if (!t.trim()) {
      alert("Impian tidak boleh kosong.");
      return;
    }
    const { error } = await sb
      .from("wishes")
      .update({ title: t.trim() })
      .eq("id", w.id);
    if (error) alert("Gagal menyimpan: " + error.message);
    else loadWishes();
  } else if (b.dataset.wdel) {
    if (!confirm("Hapus impian ini?")) return;
    const { error } = await sb.from("wishes").delete().eq("id", b.dataset.wdel);
    if (error) alert("Gagal menghapus: " + error.message);
    else {
      loadWishes();
      loadEvents();
    }
  }
};

// ---------- Kalender ----------
async function loadEvents() {
  const { data, error } = await sb
    .from("events")
    .select("id,author_id,title,event_date,kind,wish_id,repeat_yearly")
    .eq("couple_id", cid)
    .order("event_date", { ascending: true });
  if (error) {
    $("calDay").innerHTML = '<p class="msg">' + esc(error.message) + "</p>";
    return;
  }
  events = data;
  renderCal();
}

function evOn(ds) {
  const md = ds.slice(5),
    y = +ds.slice(0, 4);
  return events.filter(
    (e) =>
      e.event_date === ds ||
      (e.repeat_yearly &&
        e.event_date.slice(5) === md &&
        y >= +e.event_date.slice(0, 4)),
  );
}

function renderCal() {
  $("calTitle").textContent = MONTHS[calM] + " " + calY;
  const lead = (new Date(calY, calM, 1).getDay() + 6) % 7,
    days = new Date(calY, calM + 1, 0).getDate();
  const today = ymd(new Date());
  let h = "";
  for (let i = 0; i < lead; i++) h += '<span class="cd empty"></span>';
  for (let d = 1; d <= days; d++) {
    const ds =
      calY +
      "-" +
      String(calM + 1).padStart(2, "0") +
      "-" +
      String(d).padStart(2, "0");
    const ks = Array.from(new Set(evOn(ds).map((e) => e.kind))).slice(0, 3);
    h +=
      '<button class="cd' +
      (ds === today ? " today" : "") +
      (ds === selDate ? " sel" : "") +
      '" data-d="' +
      ds +
      '">' +
      d +
      '<span class="dts">' +
      ks.map((k) => '<i class="k-' + k + '"></i>').join("") +
      "</span></button>";
  }
  $("calGrid").innerHTML = h;
  renderDay();
  renderUpcoming();
}

function evText(e, ds) {
  let t = names[e.author_id] || "Pasangan";
  if (e.kind === "ultah") {
    const age = +ds.slice(0, 4) - +e.event_date.slice(0, 4);
    if (age > 0) t = "ulang tahun ke-" + age + " · " + t;
  }
  return t;
}

function renderDay() {
  const list = evOn(selDate);
  $("calDay").innerHTML =
    '<div class="wh">' +
    fmt(selDate) +
    "</div>" +
    (list.length
      ? list
          .map(
            (e) =>
              '<div class="ev"><span class="ic">' +
              ICONS[e.kind] +
              '</span><div class="et"><span>' +
              esc(e.title) +
              "</span><small>" +
              esc(evText(e, selDate)) +
              "</small></div>" +
              '<button class="link" data-evedit="' +
              e.id +
              '">Ubah</button><button class="link" data-evdel="' +
              e.id +
              '">Hapus</button></div>',
          )
          .join("")
      : '<p style="color:var(--muted);margin:0 0 8px">Belum ada tanda di tanggal ini.</p>') +
    '<button class="ghost" data-evadd="1">+ Tambah tanda di tanggal ini</button>';
}

function nextOcc(e, today) {
  if (e.event_date >= today) return e.event_date;
  if (!e.repeat_yearly) return null;
  const md = e.event_date.slice(5),
    y = +today.slice(0, 4);
  let c = y + "-" + md;
  if (c < today) c = y + 1 + "-" + md;
  return c;
}

function renderUpcoming() {
  const today = ymd(new Date());
  const items = events
    .map((e) => ({ e, o: nextOcc(e, today) }))
    .filter((x) => x.o)
    .sort((a, b) => (a.o < b.o ? -1 : 1))
    .slice(0, 8);
  if (!items.length) {
    $("calUp").innerHTML =
      '<p style="color:var(--muted);margin:0">Belum ada acara yang akan datang.</p>';
    return;
  }
  $("calUp").innerHTML = items
    .map((x) => {
      const left = Math.round(
        (new Date(x.o + "T00:00:00") - new Date(today + "T00:00:00")) /
          86400000,
      );
      return (
        '<div class="ev"><span class="ic">' +
        ICONS[x.e.kind] +
        '</span><div class="et"><span>' +
        esc(x.e.title) +
        "</span><small>" +
        fmt(x.o) +
        (x.e.kind === "ultah"
          ? " · " + esc(evText(x.e, x.o).split(" · ")[0])
          : "") +
        " · " +
        (left === 0 ? "hari ini" : left + " hari lagi") +
        "</small></div></div>"
      );
    })
    .join("");
}

$("calPrev").onclick = () => {
  calM--;
  if (calM < 0) {
    calM = 11;
    calY--;
  }
  renderCal();
};
$("calNext").onclick = () => {
  calM++;
  if (calM > 11) {
    calM = 0;
    calY++;
  }
  renderCal();
};
$("calGrid").onclick = (e) => {
  const b = e.target.closest(".cd");
  if (b && b.dataset.d) {
    selDate = b.dataset.d;
    renderCal();
  }
};

// Form tanda acara
function fillWishSelect() {
  const opts = [
    '<option value="">Pilih dari daftar impian (atau tulis sendiri di bawah)</option>',
  ].concat(
    wishes
      .filter((w) => !w.done)
      .map((w) => '<option value="' + w.id + '">' + esc(w.title) + "</option>"),
  );
  const keep = $("eWish").value;
  $("eWish").innerHTML = opts.join("");
  $("eWish").value = keep;
}
function kindUI() {
  const k = $("eKind").value;
  $("eWish").classList.toggle("hidden", k !== "impian");
  $("eTitle").placeholder =
    k === "impian"
      ? "Rencana, misalnya: Berangkat liburan ke Bali"
      : k === "jadwal"
        ? "Jadwal, misalnya: Nonton bareng"
        : "Nama, misalnya: Ulang tahun Dia";
  $("eNote").textContent =
    k === "ultah"
      ? "Ulang tahun otomatis muncul lagi setiap tahun. Isi tanggal lahir asli supaya umurnya terhitung."
      : "";
}
$("eKind").onchange = kindUI;
$("eWish").onchange = () => {
  const w = wishes.find((x) => x.id === $("eWish").value);
  if (w) $("eTitle").value = w.title;
};

let editingEv = null;
function openEvForm(ev) {
  editingEv = ev || null;
  $("eKind").value = ev ? ev.kind : "impian";
  fillWishSelect();
  $("eWish").value = ev && ev.wish_id ? ev.wish_id : "";
  $("eTitle").value = ev ? ev.title : "";
  $("eDateIn").value = ev ? ev.event_date : selDate;
  $("mEv").textContent = "";
  kindUI();
  $("eForm").classList.remove("hidden");
  $("eForm").scrollIntoView({ behavior: "smooth", block: "center" });
}
function closeEvForm() {
  editingEv = null;
  $("eForm").classList.add("hidden");
}
$("bCancelEv").onclick = closeEvForm;

$("bSaveEv").onclick = async () => {
  const kind = $("eKind").value,
    title = $("eTitle").value.trim(),
    date = $("eDateIn").value;
  $("mEv").textContent = "";
  if (!title) {
    $("mEv").textContent = "Tulis nama acaranya dulu.";
    return;
  }
  if (!date) {
    $("mEv").textContent = "Pilih tanggalnya dulu.";
    return;
  }
  const row = {
    title,
    event_date: date,
    kind,
    repeat_yearly: kind === "ultah",
    wish_id: kind === "impian" && $("eWish").value ? $("eWish").value : null,
  };
  const r = editingEv
    ? await sb.from("events").update(row).eq("id", editingEv.id)
    : await sb.from("events").insert(Object.assign({ couple_id: cid }, row));
  if (r.error) {
    $("mEv").textContent = "Gagal menyimpan: " + r.error.message;
    return;
  }
  selDate = date;
  calY = +date.slice(0, 4);
  calM = +date.slice(5, 7) - 1;
  closeEvForm();
  loadEvents();
};

$("calDay").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.evadd) openEvForm(null);
  else if (b.dataset.evedit) {
    const ev = events.find((x) => x.id === b.dataset.evedit);
    if (ev) openEvForm(ev);
  } else if (b.dataset.evdel) {
    if (!confirm("Hapus tanda ini?")) return;
    const { error } = await sb
      .from("events")
      .delete()
      .eq("id", b.dataset.evdel);
    if (error) alert("Gagal menghapus: " + error.message);
    else loadEvents();
  }
};

// ---------- Tabungan ----------
let sInfo = null,
  savings = [];
const rp = (n) => "Rp" + Number(n).toLocaleString("id-ID");
const toNum = (v) => parseInt(String(v).replace(/\D/g, ""), 10);

async function loadSavings() {
  const a = await sb
    .from("savings_info")
    .select("bank_name,account_number,account_holder")
    .eq("couple_id", cid)
    .maybeSingle();
  const b = await sb
    .from("savings")
    .select("id,author_id,amount,note,saved_on,created_at")
    .eq("couple_id", cid)
    .order("saved_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (b.error) {
    $("sList").innerHTML = '<p class="msg">' + esc(b.error.message) + "</p>";
    return;
  }
  sInfo = a.data || null;
  savings = b.data;
  renderSavings();
}

function renderSavings() {
  const has = sInfo && sInfo.account_number;
  $("sAcc").innerHTML = has
    ? '<small style="color:var(--muted)">Rekening tabungan kita</small>' +
      '<div style="font-weight:600;margin:2px 0">' +
      esc(sInfo.bank_name || "") +
      "</div>" +
      '<div class="code" style="font-size:1.2rem">' +
      esc(sInfo.account_number) +
      "</div>" +
      '<div style="color:var(--muted)">a.n. ' +
      esc(sInfo.account_holder || "-") +
      "</div>" +
      '<div style="margin-top:8px"><button class="link" data-acc="copy">Salin nomor</button> <button class="link" data-acc="edit">Ubah</button></div>'
    : '<p style="margin:0 0 10px;color:var(--muted)">Belum ada nomor rekening tabungan.</p><button class="ghost" data-acc="edit">+ Tambah nomor rekening</button>';

  const total = savings.reduce((s, x) => s + Number(x.amount), 0),
    by = {};
  savings.forEach((x) => {
    const n = names[x.author_id] || "Pasangan";
    by[n] = (by[n] || 0) + Number(x.amount);
  });
  $("sTotal").innerHTML =
    '<small style="color:var(--muted)">Total tabungan</small>' +
    '<div class="names" style="color:var(--rose)">' +
    rp(total) +
    "</div>" +
    Object.keys(by)
      .map(
        (n) =>
          '<div style="color:var(--muted)">' +
          esc(n) +
          ": " +
          rp(by[n]) +
          "</div>",
      )
      .join("");

  $("sList").innerHTML = savings.length
    ? '<div class="wh">Riwayat tabungan</div>' +
      savings
        .map(
          (x) =>
            '<div class="wish"><div class="wt"><span>' +
            rp(x.amount) +
            " · " +
            esc(names[x.author_id] || "Pasangan") +
            "</span><small>" +
            fmt(x.saved_on) +
            (x.note ? " · " + esc(x.note) : "") +
            "</small></div>" +
            (x.author_id === uid
              ? '<button class="link" data-sedit="' +
                x.id +
                '">Ubah</button><button class="link" data-sdel="' +
                x.id +
                '">Hapus</button>'
              : "") +
            "</div>",
        )
        .join("")
    : '<p class="empty">Belum ada catatan tabungan. Ketuk + Catat tabungan di atas.</p>';
}

// Rekening
$("sAcc").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.acc === "copy") {
    try {
      await navigator.clipboard.writeText(sInfo.account_number);
      b.textContent = "Tersalin";
    } catch (err) {
      prompt("Salin nomor rekening ini:", sInfo.account_number);
    }
  } else if (b.dataset.acc === "edit") {
    $("aBank").value = sInfo ? sInfo.bank_name || "" : "";
    $("aNo").value = sInfo ? sInfo.account_number || "" : "";
    $("aName").value = sInfo ? sInfo.account_holder || "" : "";
    $("mAcc").textContent = "";
    $("aForm").classList.remove("hidden");
    $("aBank").focus();
  }
};
$("bCancelAcc").onclick = () => $("aForm").classList.add("hidden");
$("bSaveAcc").onclick = async () => {
  const row = {
    bank_name: $("aBank").value.trim() || null,
    account_number: $("aNo").value.trim(),
    account_holder: $("aName").value.trim() || null,
  };
  $("mAcc").textContent = "";
  if (!row.account_number) {
    $("mAcc").textContent = "Isi nomor rekeningnya dulu.";
    return;
  }
  const r = sInfo
    ? await sb.from("savings_info").update(row).eq("couple_id", cid)
    : await sb
        .from("savings_info")
        .insert(Object.assign({ couple_id: cid }, row));
  if (r.error) {
    $("mAcc").textContent = "Gagal menyimpan: " + r.error.message;
    return;
  }
  $("aForm").classList.add("hidden");
  loadSavings();
};

// Catat tabungan
$("bShowSave").onclick = () => {
  $("sWho").textContent = names[uid] || "Kamu";
  $("sDate").value = ymd(new Date());
  $("mSave").textContent = "";
  $("sForm").classList.toggle("hidden");
  if (!$("sForm").classList.contains("hidden")) $("sAmt").focus();
};
$("bCancelSave").onclick = () => {
  $("sAmt").value = "";
  $("sNote").value = "";
  $("sForm").classList.add("hidden");
};
$("bSave").onclick = async () => {
  const amt = toNum($("sAmt").value),
    date = $("sDate").value;
  $("mSave").textContent = "";
  if (!amt || amt < 1) {
    $("mSave").textContent =
      "Isi jumlah tabungan dengan angka, misalnya 50000.";
    return;
  }
  if (!date) {
    $("mSave").textContent = "Pilih tanggalnya dulu.";
    return;
  }
  const { error } = await sb.from("savings").insert({
    couple_id: cid,
    amount: amt,
    note: $("sNote").value.trim() || null,
    saved_on: date,
  });
  if (error) {
    $("mSave").textContent = "Gagal menyimpan: " + error.message;
    return;
  }
  $("sAmt").value = "";
  $("sNote").value = "";
  $("sForm").classList.add("hidden");
  loadSavings();
};

// Ubah / hapus catatan tabungan milik sendiri
$("sList").onclick = async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.sdel) {
    if (!confirm("Hapus catatan tabungan ini?")) return;
    const { error } = await sb
      .from("savings")
      .delete()
      .eq("id", b.dataset.sdel);
    if (error) alert("Gagal menghapus: " + error.message);
    else loadSavings();
  } else if (b.dataset.sedit) {
    const x = savings.find((s) => s.id === b.dataset.sedit);
    if (!x) return;
    const a = prompt("Jumlah tabungan:", x.amount);
    if (a === null) return;
    const n = toNum(a);
    if (!n || n < 1) {
      alert("Jumlah harus berupa angka lebih dari 0.");
      return;
    }
    const c = prompt(
      "Catatan (kosongkan untuk menghapus catatan):",
      x.note || "",
    );
    if (c === null) return;
    const { error } = await sb
      .from("savings")
      .update({ amount: n, note: c.trim() || null })
      .eq("id", x.id);
    if (error) alert("Gagal menyimpan: " + error.message);
    else loadSavings();
  }
};

// ---------- Tampilan masuk: ganti Masuk / Daftar ----------
function authMode(m) {
  const s = m === "signup";
  $("bLogin").classList.toggle("hidden", s);
  $("bSignup").classList.toggle("hidden", !s);
  $("swLogin").classList.toggle("hidden", s);
  $("swSignup").classList.toggle("hidden", !s);
  $("aTitle").textContent = s ? "BUAT AKUN" : "SELAMAT DATANG";
  $("aSub").textContent = s
    ? "Daftar dulu, lalu buat ruang atau gabung dengan kode undangan."
    : "Masuk untuk membuka kenangan dan rencana kita.";
  $("pass").autocomplete = s ? "new-password" : "current-password";
  $("mAuth").textContent = "";
}
$("goSignup").onclick = (e) => {
  e.preventDefault();
  authMode("signup");
};
$("goLogin").onclick = (e) => {
  e.preventDefault();
  authMode("login");
};
$("pass").addEventListener("keydown", (e) => {
  if (e.key === "Enter")
    ($("bSignup").classList.contains("hidden")
      ? $("bLogin")
      : $("bSignup")
    ).click();
});

// ---------- Notifikasi aktivitas ----------
const KIND_ICON = {
  postingan: "📷",
  impian: "🎯",
  jadwal: "🗓",
  tabungan: "💰",
  rekening: "💳",
  profil: "👤",
};
let acts = [],
  seenAt = null,
  prevSeen = null,
  actCh = null,
  toastT = null;

function relTime(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "baru saja";
  if (s < 3600) return Math.floor(s / 60) + " menit lalu";
  if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
  if (s < 604800) return Math.floor(s / 86400) + " hari lalu";
  return fmt(ymd(new Date(iso)));
}
function isNew(a, since) {
  return (
    a.actor_id !== uid && (!since || new Date(a.created_at) > new Date(since))
  );
}
function who(id) {
  return id === uid ? "Kamu" : names[id] || "Pasangan";
}

async function loadActivity() {
  const a = await sb
    .from("activity")
    .select("id,actor_id,action,kind,summary,created_at")
    .eq("couple_id", cid)
    .order("created_at", { ascending: false })
    .limit(60);
  const s = await sb
    .from("activity_seen")
    .select("seen_at")
    .eq("user_id", uid)
    .maybeSingle();
  if (a.error) return;
  acts = a.data;
  seenAt = s.data ? s.data.seen_at : null;
  renderBadge();
  if (!$("notifView").classList.contains("hidden")) renderNotif();
}

function renderBadge() {
  const n = acts.filter((a) => isNew(a, seenAt)).length;
  $("bBadge").textContent = n > 99 ? "99+" : n;
  $("bBadge").classList.toggle("hidden", n === 0);
}

function renderNotif() {
  $("nList").innerHTML = acts.length
    ? acts
        .map(
          (a) =>
            '<div class="nitem' +
            (isNew(a, prevSeen) ? " new" : "") +
            '"><span class="ic">' +
            (KIND_ICON[a.kind] || "🔔") +
            "</span><div><span><b>" +
            esc(who(a.actor_id)) +
            "</b> " +
            esc(a.summary) +
            "</span><small>" +
            relTime(a.created_at) +
            "</small></div></div>",
        )
        .join("")
    : '<p class="empty">Belum ada aktivitas. Yang kalian tambah atau ubah akan muncul di sini.</p>';
}

$("bBell").onclick = async () => {
  $("notifView").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  await loadActivity();
  prevSeen = seenAt;
  renderNotif();
  await sb.rpc("mark_activity_seen");
  await loadActivity();
};
$("nBack").onclick = () => {
  $("notifView").classList.add("hidden");
  document.body.style.overflow = "";
};

function showToast(t) {
  const el = $("toast");
  el.textContent = t;
  el.classList.remove("hidden");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.add("hidden"), 5000);
}

function subscribeActivity() {
  if (actCh) {
    sb.removeChannel(actCh);
    actCh = null;
  }
  actCh = sb
    .channel("act-" + cid)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "activity",
        filter: "couple_id=eq." + cid,
      },
      (p) => {
        const r = p.new;
        if (!r || r.actor_id === uid) return;
        showToast(who(r.actor_id) + " " + r.summary);
        loadActivity();
        if (r.kind === "postingan") loadFeed();
        else if (r.kind === "impian") loadWishes();
        else if (r.kind === "jadwal") loadEvents();
        else if (r.kind === "tabungan" || r.kind === "rekening") loadSavings();
      },
    )
    .subscribe();
}
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && cid) loadActivity();
});

// ---------- Peta dan lokasi ----------
let lmap = null,
  lmarks = {},
  locs = {},
  locSharing = false,
  locWatch = null,
  locCh = null,
  locPoll = null,
  locFitted = false;
const LOC_FRESH = 15 * 60 * 1000;

function ago(iso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  if (s < 60) return "baru saja";
  if (s < 3600) return Math.floor(s / 60) + " menit lalu";
  if (s < 86400) return Math.floor(s / 3600) + " jam lalu";
  return Math.floor(s / 86400) + " hari lalu";
}
function locFresh(r) {
  return !!r && Date.now() - new Date(r.updated_at) < LOC_FRESH;
}
function pinIcon(name, other) {
  return L.divIcon({
    className: "pinwrap",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html:
      '<div class="pin' +
      (other ? " other" : "") +
      '">' +
      esc((name || "?").trim().charAt(0).toUpperCase()) +
      "</div>",
  });
}

async function openMap() {
  if (typeof L === "undefined") {
    $("mapMsg").textContent =
      "Peta gagal dimuat. Periksa koneksi internet lalu muat ulang.";
    return;
  }
  if (!lmap) {
    lmap = L.map("mapBox").setView([-2.5, 118], 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(lmap);
  }
  setTimeout(() => lmap.invalidateSize(), 80);
  renderShareUI();
  await loadLocs(true);
  if (!locCh) {
    locCh = sb
      .channel("loc-" + cid)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "locations",
          filter: "couple_id=eq." + cid,
        },
        () => loadLocs(false),
      )
      .subscribe();
  }
  clearInterval(locPoll);
  locPoll = setInterval(() => loadLocs(false), 10000);
}
function stopMapView() {
  clearInterval(locPoll);
  locPoll = null;
}

async function loadLocs(fit) {
  const { data, error } = await sb
    .from("locations")
    .select("user_id,lat,lng,accuracy,updated_at")
    .eq("couple_id", cid);
  if (error) {
    $("mapMsg").textContent = "Gagal memuat lokasi: " + error.message;
    return;
  }
  locs = {};
  (data || []).forEach((r) => (locs[r.user_id] = r));
  if (!locSharing && locs[uid]) {
    sb.from("locations").delete().eq("user_id", uid);
    delete locs[uid];
  }
  renderMap(fit);
}

function renderShareUI() {
  $("bShare").textContent = locSharing
    ? "Berhenti berbagi lokasi"
    : "Bagikan lokasi saya";
  $("bShare").classList.toggle("ghost", locSharing);
  $("meState").textContent = locSharing
    ? "Kamu sedang membagikan lokasi ke pasangan."
    : "Lokasimu tidak dibagikan.";
}

function renderMap(fit) {
  if (!lmap) return;
  Object.keys(lmarks).forEach((id) => {
    if (!locFresh(locs[id])) {
      lmap.removeLayer(lmarks[id]);
      delete lmarks[id];
    }
  });
  const pts = [];
  Object.keys(locs).forEach((id) => {
    const r = locs[id];
    if (!locFresh(r)) return;
    const ll = [r.lat, r.lng],
      nm = id === uid ? "Kamu" : names[id] || "Pasangan";
    if (lmarks[id]) lmarks[id].setLatLng(ll);
    else
      lmarks[id] = L.marker(ll, { icon: pinIcon(names[id], id !== uid) }).addTo(
        lmap,
      );
    lmarks[id].bindPopup(esc(nm) + "<br>diperbarui " + ago(r.updated_at));
    pts.push(ll);
  });
  if ((fit || !locFitted) && pts.length) {
    if (pts.length === 1) lmap.setView(pts[0], 16);
    else lmap.fitBounds(pts, { padding: [50, 50], maxZoom: 17 });
    locFitted = true;
  }
  const pid = Object.keys(names).find((k) => k !== uid),
    r = pid ? locs[pid] : null;
  if (!pid) $("otherState").textContent = "Pasanganmu belum bergabung.";
  else if (locFresh(r)) {
    $("otherState").innerHTML =
      esc(names[pid] || "Pasangan") +
      " sedang membagikan lokasi · diperbarui " +
      ago(r.updated_at) +
      (r.accuracy
        ? " · akurasi sekitar " + Math.round(r.accuracy) + " m"
        : "") +
      ' · <a href="https://www.google.com/maps?q=' +
      r.lat +
      "," +
      r.lng +
      '" target="_blank" rel="noopener" style="color:var(--rose)">Buka di Google Maps</a>';
  } else if (r)
    $("otherState").textContent =
      (names[pid] || "Pasangan") +
      " terakhir membagikan lokasi " +
      ago(r.updated_at) +
      " (sudah tidak aktif).";
  else
    $("otherState").textContent =
      (names[pid] || "Pasangan") + " belum membagikan lokasi.";
}

function startShare() {
  if (!navigator.geolocation) {
    $("mapMsg").textContent = "Browser ini tidak mendukung lokasi.";
    return;
  }
  $("mapMsg").textContent = "Meminta izin lokasi...";
  let last = 0;
  locWatch = navigator.geolocation.watchPosition(
    async (pos) => {
      locSharing = true;
      renderShareUI();
      const c = pos.coords,
        now = Date.now(),
        iso = new Date().toISOString();
      locs[uid] = {
        user_id: uid,
        lat: c.latitude,
        lng: c.longitude,
        accuracy: c.accuracy,
        updated_at: iso,
      };
      renderMap(false);
      if (now - last < 10000) return;
      last = now;
      const { error } = await sb
        .from("locations")
        .upsert(
          {
            user_id: uid,
            couple_id: cid,
            lat: c.latitude,
            lng: c.longitude,
            accuracy: c.accuracy,
            updated_at: iso,
          },
          { onConflict: "user_id" },
        );
      $("mapMsg").textContent = error
        ? "Gagal mengirim lokasi: " + error.message
        : "";
    },
    (err) => {
      if (err.code === 1) {
        stopShare(false);
        $("mapMsg").textContent =
          "Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.";
      } else if (err.code === 2)
        $("mapMsg").textContent =
          "Lokasi belum tersedia. Pastikan GPS menyala.";
      else $("mapMsg").textContent = "Mencari lokasimu...";
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 },
  );
}

async function stopShare(del) {
  if (locWatch !== null) {
    navigator.geolocation.clearWatch(locWatch);
    locWatch = null;
  }
  locSharing = false;
  if (del && uid) {
    await sb.from("locations").delete().eq("user_id", uid);
    delete locs[uid];
  }
  if (lmap) {
    renderShareUI();
    renderMap(false);
  }
}

$("bShare").onclick = () => {
  if (locSharing) stopShare(true);
  else startShare();
};
$("bFit").onclick = () => renderMap(true);

// ---------- Panduan pertama kali masuk ----------
const ONB = [
  {
    i: "💞",
    t: "Selamat datang di ruang kalian",
    d: "Ini tempat pribadi berdua untuk menyimpan kenangan, rencana, dan tabungan. Panduan singkat ini mengenalkan semua fiturnya.",
  },
  {
    i: "🏠",
    t: "Beranda",
    d: "Menampilkan nama kalian, tanggal jadian, dan penghitung waktu bersama. Di bawahnya ada foto dan video yang bisa dibuka layar penuh. Nama dan tanggal jadian bisa diubah lewat Ubah nama dan tanggal jadian.",
  },
  {
    i: "➕",
    t: "Tambah postingan",
    d: "Pilih beberapa foto atau video sekaligus (maksimal 10), atur urutannya, lalu beri judul dan tanggal. Buka sebuah postingan untuk mengubah judul dan ceritanya atau menghapusnya.",
  },
  {
    i: "🎯",
    t: "Impian dan kalender",
    d: "Tulis impian bersama dan tandai kalau sudah terwujud. Di kalender, beri tanda rencana impian, jadwal main, dan ulang tahun.",
  },
  {
    i: "💰",
    t: "Tabungan",
    d: "Simpan nomor rekening tabungan dan catat siapa menabung berapa. Nama terisi otomatis, jumlahnya diisi manual. Ini hanya catatan dan tidak terhubung ke bank. Jangan menulis PIN atau password di sini.",
  },
  {
    i: "📍",
    t: "Peta",
    d: "Bagikan lokasimu ke pasangan hanya jika kamu menekan tombolnya, dan hentikan kapan saja. Lokasi hanya diperbarui selama halaman terbuka dan layar menyala.",
  },
  {
    i: "🔔",
    t: "Notifikasi",
    d: "Ikon lonceng di bagian atas menunjukkan apa saja yang ditambah atau diubah pasangan. Angka merah artinya ada kabar baru.",
  },
  {
    i: "📲",
    t: "Tambahkan ke layar utama",
    html: `<div class="onbhow"><p style="margin:0 0 8px">Buka web lewat <b>Chrome</b> (Android) atau <b>Safari</b> (iPhone), bukan dari dalam WhatsApp.</p><b>Android (Chrome)</b><ol><li>Ketuk menu <b>⋮</b> di pojok kanan atas.</li><li>Pilih <b>Tambahkan ke layar utama</b> atau <b>Instal aplikasi</b>.</li><li>Ketuk <b>Tambahkan</b>.</li></ol><b>iPhone (Safari)</b><ol><li>Ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas) di bagian bawah.</li><li>Gulir dan pilih <b>Tambah ke Layar Utama</b>.</li><li>Ketuk <b>Tambah</b>.</li></ol><p style="color:var(--muted);margin:0">Setelah itu buka dari ikon di layar utama. Kalau diminta, masuk sekali lagi di sana.</p></div>`,
  },
];
let onbI = 0,
  onbOpen = false;
function maybeOnboard() {
  if (onbOpen) return;
  let seen = false;
  try {
    seen = !!localStorage.getItem("onb1-" + uid);
  } catch (e) {}
  if (!seen) showOnboard();
}
function showOnboard() {
  onbI = 0;
  onbOpen = true;
  try {
    localStorage.setItem("onb1-" + uid, "1");
  } catch (e) {}
  $("onb").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  renderOnb();
}
function closeOnboard() {
  onbOpen = false;
  $("onb").classList.add("hidden");
  document.body.style.overflow = "";
}
function renderOnb() {
  const s = ONB[onbI],
    last = onbI === ONB.length - 1;
  $("onbCard").innerHTML =
    '<div class="onbstep"><div class="big">' +
    s.i +
    "</div><h2>" +
    esc(s.t) +
    "</h2>" +
    (s.d ? '<p style="color:var(--muted)">' + esc(s.d) + "</p>" : "") +
    "</div>" +
    (s.html || "") +
    '<div class="onbdots">' +
    ONB.map((_, k) => '<i class="' + (k === onbI ? "on" : "") + '"></i>').join(
      "",
    ) +
    "</div>" +
    '<div class="onbbtns">' +
    (onbI === 0
      ? '<button class="link" data-o="skip">Lewati</button>'
      : '<button class="link" data-o="back">‹ Kembali</button>') +
    '<button data-o="' +
    (last ? "done" : "next") +
    '">' +
    (last ? "Mulai" : "Lanjut") +
    "</button></div>";
}
$("onbCard").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const o = b.dataset.o;
  if (o === "next") onbI++;
  else if (o === "back") onbI--;
  else {
    closeOnboard();
    return;
  }
  renderOnb();
};
$("bGuide").onclick = showOnboard;

// ---------- Pilih media (langkah 1) ----------
function readMeta(f) {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(f);
    if (f.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.playsInline = true;
      v.onloadedmetadata = () =>
        ok({
          type: "v",
          url,
          w: v.videoWidth || 16,
          h: v.videoHeight || 9,
        });
      v.onerror = () => {
        URL.revokeObjectURL(url);
        fail(new Error("Video tidak bisa dibaca di browser ini."));
      };
      v.src = url;
    } else {
      const im = new Image();
      im.onload = () =>
        ok({ type: "i", url, w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => {
        URL.revokeObjectURL(url);
        fail(new Error("File gambar tidak bisa dibaca."));
      };
      im.src = url;
    }
  });
}

function renderPick() {
  const p = sel[cur];
  $("pvBox").innerHTML = p
    ? p.type === "v"
      ? '<video src="' + p.url + '" controls playsinline></video>'
      : '<img src="' + p.url + '" alt="Pratinjau">'
    : '<div class="pvEmpty">Belum ada foto atau video dipilih.<br>Ketuk + Pilih dari galeri.</div>';
  $("pvTools").classList.toggle("hidden", !p);
  $("tCount").textContent = "Terpilih " + sel.length + "/" + MAXN;
  $("grid").innerHTML = sel
    .map(
      (s, i) =>
        '<div class="th' +
        (i === cur ? " on" : "") +
        '" data-i="' +
        i +
        '">' +
        (s.type === "v"
          ? '<video src="' +
            s.url +
            '#t=0.1" muted playsinline preload="metadata"></video><span class="vb">▶</span>'
          : '<img src="' + s.url + '" alt="">') +
        '<span class="nb">' +
        (i + 1) +
        "</span></div>",
    )
    .join("");
  $("bNext").disabled = !sel.length;
}

$("bPick").onclick = () => $("pFile").click();
$("pFile").onchange = async () => {
  const fs = Array.from($("pFile").files);
  $("pFile").value = "";
  $("mPick").textContent = "";
  for (const f of fs) {
    if (sel.length >= MAXN) {
      $("mPick").textContent =
        "Maksimal " + MAXN + " foto atau video per postingan.";
      break;
    }
    if (!/^(image|video)\//.test(f.type)) {
      $("mPick").textContent = "File yang bukan foto atau video dilewati.";
      continue;
    }
    if (f.type.startsWith("video/") && f.size > MAXVID) {
      $("mPick").textContent =
        "Video di atas 45 MB dilewati. Potong atau kecilkan dulu.";
      continue;
    }
    try {
      const m = await readMeta(f);
      sel.push(Object.assign({ file: f }, m));
    } catch (err) {
      $("mPick").textContent = err.message;
    }
  }
  if (cur >= sel.length) cur = Math.max(0, sel.length - 1);
  renderPick();
};
$("grid").onclick = (e) => {
  const t = e.target.closest(".th");
  if (t) {
    cur = +t.dataset.i;
    renderPick();
  }
};
$("tUp").onclick = () => {
  if (cur > 0) {
    [sel[cur - 1], sel[cur]] = [sel[cur], sel[cur - 1]];
    cur--;
    renderPick();
  }
};
$("tDown").onclick = () => {
  if (cur < sel.length - 1) {
    [sel[cur + 1], sel[cur]] = [sel[cur], sel[cur + 1]];
    cur++;
    renderPick();
  }
};
$("tDel").onclick = () => {
  URL.revokeObjectURL(sel[cur].url);
  sel.splice(cur, 1);
  cur = Math.max(0, Math.min(cur, sel.length - 1));
  renderPick();
};

function resetPost() {
  sel.forEach((s) => URL.revokeObjectURL(s.url));
  sel = [];
  cur = 0;
  $("pTitle").value = "";
  $("pCap").value = "";
  $("mPost").textContent = "";
  $("mPick").textContent = "";
  $("stInfo").classList.add("hidden");
  $("stPick").classList.remove("hidden");
  renderPick();
}
$("bClose").onclick = () => {
  resetPost();
  tab("beranda");
};
$("bNext").onclick = () => {
  $("stPick").classList.add("hidden");
  $("stInfo").classList.remove("hidden");
  window.scrollTo(0, 0);
};
$("bBack").onclick = () => {
  $("stInfo").classList.add("hidden");
  $("stPick").classList.remove("hidden");
};

// ---------- Unggah (langkah 2) ----------
function shrink(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height)),
          c = document.createElement("canvas");
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(
          (b) => (b ? ok(b) : fail(new Error("Gagal memproses foto"))),
          "image/jpeg",
          0.8,
        );
      };
      im.onerror = () => fail(new Error("File bukan gambar"));
      im.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

$("bPost").onclick = async () => {
  const title = $("pTitle").value.trim(),
    date = $("pDate").value;
  $("mPost").textContent = "";
  if (!title || !date) {
    $("mPost").textContent = "Isi judul dan tanggal dulu.";
    return;
  }
  if (!sel.length) {
    $("mPost").textContent = "Pilih minimal satu foto atau video.";
    return;
  }
  $("bPost").disabled = true;
  const media = [];
  let done = false;
  try {
    for (let i = 0; i < sel.length; i++) {
      const s = sel[i];
      $("mPost").textContent =
        "Mengunggah " +
        (i + 1) +
        " dari " +
        sel.length +
        (s.type === "v" ? " (video, mungkin agak lama)" : "") +
        "...";
      let blob, ct, ext;
      if (s.type === "i") {
        blob = await shrink(s.file);
        ct = "image/jpeg";
        ext = "jpg";
      } else {
        blob = s.file;
        ct = s.file.type || "video/mp4";
        ext =
          (s.file.name.split(".").pop() || "mp4")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "mp4";
      }
      const path = cid + "/" + crypto.randomUUID() + "." + ext;
      const up = await sb.storage
        .from("photos")
        .upload(path, blob, { contentType: ct });
      if (up.error) throw up.error;
      media.push({ p: path, t: s.type, w: s.w, h: s.h });
    }
    const ins = await sb.from("posts").insert({
      couple_id: cid,
      title,
      post_date: date,
      caption: $("pCap").value.trim() || null,
      image_path: media[0].p,
      image_paths: media.map((m) => m.p),
      media,
    });
    if (ins.error) throw ins.error;
    done = true;
  } catch (err) {
    if (media.length)
      await sb.storage.from("photos").remove(media.map((m) => m.p));
    $("mPost").textContent = "Gagal: " + err.message;
  }
  $("bPost").disabled = false;
  if (done) {
    curPT = media.every((m) => m.t === "v") ? "video" : "foto";
    resetPost();
    tab("beranda");
    loadFeed();
  }
};

renderPick();
route();
