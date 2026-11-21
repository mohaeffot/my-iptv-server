(() => {
  const KEY = "myIptvServer.channels.v1";
  const $ = id => document.getElementById(id);
  let channels = load();
  let editingId = null;
  let lastImport = "—";

  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
  function save(){ localStorage.setItem(KEY, JSON.stringify(channels)); render(); }
  function esc(s=""){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function toast(msg){ const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2400); }
  function showView(view){
    document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+view));
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    const titles={dashboard:"الرئيسية",channels:"القنوات المباشرة",movies:"الأفلام",series:"المسلسلات",settings:"الإعدادات"};
    $("page-title").textContent=titles[view]||"الرئيسية";
  }
  document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
  $("quick-channels").onclick=()=>showView("channels");
  $("quick-import").onclick=()=>pickFile();
  $("import-top").onclick=$("import-channels").onclick=$("empty-import").onclick=pickFile;
  $("quick-export").onclick=$("export-channels").onclick=exportM3U;
  $("add-channel").onclick=()=>openModal();
  $("close-modal").onclick=$("cancel-modal").onclick=closeModal;
  $("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal()});
  $("m3u-file").addEventListener("change",handleFile);
  $("search").addEventListener("input",renderRows);
  $("category-filter").addEventListener("change",renderRows);
  $("clear-data").onclick=()=>{if(confirm("هل تريد حذف جميع القنوات المحفوظة في هذا المتصفح؟")){channels=[];save();toast("تم مسح البيانات المحلية");}};
  $("channel-form").addEventListener("submit",e=>{
    e.preventDefault();
    const item={id:editingId||crypto.randomUUID(),name:$("channel-name").value.trim(),category:$("channel-category").value.trim()||"غير مصنف",url:$("channel-url").value.trim(),logo:$("channel-logo").value.trim()};
    if(editingId){channels=channels.map(c=>c.id===editingId?item:c);toast("تم تعديل القناة");}
    else{channels.push(item);toast("تمت إضافة القناة");}
    save();closeModal();
  });
  function openModal(item=null){
    editingId=item?.id||null;$("modal-title").textContent=item?"تعديل قناة":"إضافة قناة";
    $("channel-name").value=item?.name||"";$("channel-category").value=item?.category||"";
    $("channel-url").value=item?.url||"";$("channel-logo").value=item?.logo||"";
    $("modal").classList.add("open");
  }
  function closeModal(){$("modal").classList.remove("open");$("channel-form").reset();editingId=null;}
  function render(){
    $("stat-channels").textContent=channels.length;
    $("stat-categories").textContent=new Set(channels.map(c=>c.category||"غير مصنف")).size;
    $("stat-import").textContent=lastImport;
    const selected=$("category-filter").value;
    const cats=[...new Set(channels.map(c=>c.category||"غير مصنف"))].sort();
    $("category-filter").innerHTML='<option value="">كل التصنيفات</option>'+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    $("category-filter").value=cats.includes(selected)?selected:"";
    renderRows();
  }
  function renderRows(){
    const q=$("search").value.trim().toLowerCase(), cat=$("category-filter").value;
    const filtered=channels.filter(c=>(!cat||c.category===cat)&&(`${c.name} ${c.category} ${c.url}`).toLowerCase().includes(q));
    $("channel-rows").innerHTML=filtered.map(c=>`<tr>
      <td><div class="channel-title">${c.logo?`<img src="${esc(c.logo)}" alt="" onerror="this.style.display='none'">`:"<span>📺</span>"}${esc(c.name)}</div></td>
      <td>${esc(c.category||"غير مصنف")}</td><td><div class="url" title="${esc(c.url)}">${esc(c.url)}</div></td>
      <td><div class="row-actions"><button class="mini-btn" data-edit="${c.id}">تعديل</button><button class="mini-btn delete" data-delete="${c.id}">حذف</button></div></td>
    </tr>`).join("");
    $("empty-state").style.display=filtered.length?"none":"block";
    $("channel-rows").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openModal(channels.find(c=>c.id===b.dataset.edit)));
    $("channel-rows").querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("حذف هذه القناة؟")){channels=channels.filter(c=>c.id!==b.dataset.delete);save();toast("تم حذف القناة");}});
  }
  function pickFile(){$("m3u-file").click();}
  function parseM3U(text){
    const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/);let pending=null;const out=[];
    for(const raw of lines){const line=raw.trim();if(!line)continue;
      if(line.startsWith("#EXTINF:")){
        const name=(line.split(",").slice(1).join(",").trim()||"قناة بدون اسم");
        const group=(line.match(/group-title="([^"]*)"/i)||[])[1]||"غير مصنف";
        const logo=(line.match(/tvg-logo="([^"]*)"/i)||[])[1]||"";
        pending={name,category:group,logo};
      }else if(!line.startsWith("#")&&pending){
        out.push({...pending,id:crypto.randomUUID(),url:line});pending=null;
      }
    }return out;
  }
  async function handleFile(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      const parsed=parseM3U(await file.text());
      if(!parsed.length){toast("لم أجد قنوات بصيغة M3U صالحة");return;}
      if(confirm(`تم العثور على ${parsed.length} قناة. موافق = استبدال القائمة الحالية، إلغاء = إضافة إليها.`)){
        channels=parsed;
      }else{channels=channels.concat(parsed);}
      lastImport="تم الاستيراد";save();showView("channels");toast(`تم استيراد ${parsed.length} قناة`);
    }catch(err){toast("تعذر قراءة الملف");}
    e.target.value="";
  }
  function exportM3U(){
    if(!channels.length){toast("لا توجد قنوات لتصديرها");return;}
    const lines=["#EXTM3U"];
    channels.forEach(c=>{
      const attrs=`group-title="${(c.category||"غير مصنف").replace(/"/g,"'")}"`+(c.logo?` tvg-logo="${c.logo.replace(/"/g,"'")}"`:"");
      lines.push(`#EXTINF:-1 ${attrs},${c.name}`,c.url);
    });
    const blob=new Blob([lines.join("\n")+"\n"],{type:"audio/x-mpegurl;charset=utf-8"});
    const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="my-iptv-playlist.m3u";a.click();URL.revokeObjectURL(url);
    toast("تم تجهيز ملف M3U للتنزيل");
  }
  $("project-name").addEventListener("change",e=>{document.title=e.target.value+" — لوحة التحكم";toast("تم تحديث عنوان الصفحة");});
  render();
})();