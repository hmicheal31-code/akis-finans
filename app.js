/* Akış Finans — tamamen cihazda çalışan kişisel finans takip uygulaması */
(() => {
  'use strict';
  const STORAGE_KEY = 'akis-finans-data-v1';
  const now = new Date();
  const CURRENT_MONTH = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}`;
  const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const fmtMoney = new Intl.NumberFormat('tr-TR', {style:'currency',currency:'TRY',minimumFractionDigits:2,maximumFractionDigits:2});
  const newId = () => (globalThis.crypto && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const freshState = () => ({version:1,cards:[],installments:[],recurring:[],oneoffs:[],paid:{},settings:{openingCash:null,openingMonth:CURRENT_MONTH,savingsTarget:0}});
  let state = readState();
  let selectedMonth = CURRENT_MONTH;
  let tab = 'dashboard';
  let toastTimer;

  const el = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = (cents) => fmtMoney.format((Number(cents)||0) / 100);
  const numberInput = (cents) => cents == null ? '' : (Number(cents)/100).toFixed(2);
  const parseAmount = (raw) => {
    let s = String(raw ?? '').trim().replace(/\s|₺|TL/gi,'');
    if (!s) return NaN;
    if (s.includes(',')) s=s.replace(/\./g,'').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
    const n=Number(s);
    return Number.isFinite(n) && n >= 0 && n <= 1e12 ? Math.round(n*100) : NaN;
  };
  const monthIndex = (m) => { const p=/^(\d{4})-(\d{2})$/.exec(String(m)); return p ? Number(p[1])*12 + Number(p[2])-1 : NaN; };
  const monthFromIndex = (idx) => `${Math.floor(idx/12)}-${String((idx%12+12)%12+1).padStart(2,'0')}`;
  const shiftMonth = (m,n) => monthFromIndex(monthIndex(m)+n);
  const prettyMonth = (m) => { const p=/^(\d{4})-(\d{2})$/.exec(String(m));return p ? `${MONTHS[Number(p[2])-1]} ${p[1]}` : '—'; };
  const shortMonth = (m) => { const p=/^(\d{4})-(\d{2})$/.exec(String(m));return p ? MONTHS[Number(p[2])-1].slice(0,3) : '—'; };
  const validMonth = (m) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(m));
  const monthDay = (m,day) => {
    const [y,mo]=m.split('-').map(Number);
    const maxDay=new Date(y,mo,0).getDate();
    return `${m}-${String(Math.min(Number(day)||1,maxDay)).padStart(2,'0')}`;
  };
  const displayDate = (date) => {const [y,m,d]=date.split('-');return `${d}.${m}.${y}`;};
  const isActive = (item,m) => validMonth(item.startMonth) && monthIndex(m)>=monthIndex(item.startMonth) && (!item.endMonth || monthIndex(m)<=monthIndex(item.endMonth));
  const lastDue = (item) => shiftMonth(item.firstDueMonth, item.count-1);
  const getInstallmentAmount = (item,m) => {
    const idx=monthIndex(m)-monthIndex(item.firstDueMonth);
    if(!Number.isInteger(idx)||idx<0||idx>=item.count) return 0;
    const portion=Math.floor(item.total/item.count);
    const extra=item.total-portion*item.count;
    return portion+(idx<extra?1:0);
  };
  const getCard = id => state.cards.find(c => c.id===id);
  function readState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return freshState();
      const obj=JSON.parse(raw);
      if(!obj||obj.version!==1||!Array.isArray(obj.cards)||!Array.isArray(obj.installments)||!Array.isArray(obj.recurring)||!Array.isArray(obj.oneoffs)||typeof obj.paid!=='object'||!obj.settings) throw Error('Beklenmeyen kayıt biçimi');
      return obj;
    } catch(err){console.warn('Veriler okunamadı:',err);return freshState();}
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch(err){console.error(err);toast('Depolama dolu veya engellenmiş; yedek al.');}
    render();
  }
  function toast(message){
    const node=el('toast');node.textContent=message;node.classList.add('show');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3500);
  }
  function currentEvents(m){
    const events=[];
    state.recurring.forEach(r=>{
      if(!isActive(r,m)) return;
      events.push({id:`rec:${r.id}:${m}`,type:r.type,label:r.title,amount:r.amount,date:monthDay(m,r.day),note:r.type==='income'?'Düzenli gelir':r.category==='loan'?'Kredi taksiti':'Sabit ödeme',icon:r.type==='income'?'↗':r.category==='loan'?'⌂':'◎'});
    });
    state.cards.forEach(card=>{
      const entries=state.installments.filter(t=>t.cardId===card.id).map(t=>({t,amount:getInstallmentAmount(t,m)})).filter(x=>x.amount>0);
      if(!entries.length) return;
      events.push({id:`card:${card.id}:${m}`,type:'expense',label:card.name+' — kart ödemesi',amount:entries.reduce((sum,x)=>sum+x.amount,0),date:monthDay(m,card.dueDay),note:`${entries.length} alışveriş / taksit kalemi • Kesim: ${card.closingDay}. gün`,icon:'▰',cardId:card.id});
    });
    state.oneoffs.forEach(o=>{
      if(o.date.slice(0,7)!==m) return;
      events.push({id:`once:${o.id}`,type:o.type,label:o.title,amount:o.amount,date:o.date,note:o.type==='income'?'Tek seferlik gelir':'Tek seferlik ödeme',icon:o.type==='income'?'↗':'↓'});
    });
    return events.sort((a,b)=>a.date.localeCompare(b.date) || ((a.type==='expense'?0:1)-(b.type==='expense'?0:1)));
  }
  function summary(m){
    const events=currentEvents(m);
    const income=events.filter(e=>e.type==='income').reduce((a,b)=>a+b.amount,0);
    const out=events.filter(e=>e.type==='expense').reduce((a,b)=>a+b.amount,0);
    const card=events.filter(e=>e.cardId).reduce((a,b)=>a+b.amount,0);
    const loan=events.filter(e=>e.type==='expense'&&e.note==='Kredi taksiti').reduce((a,b)=>a+b.amount,0);
    const unpaid=events.filter(e=>e.type==='expense'&&!state.paid[e.id]).reduce((a,b)=>a+b.amount,0);
    return {events,income,out,card,loan,other:out-card-loan,unpaid,net:income-out,available:income-out-(Number(state.settings.savingsTarget)||0)};
  }
  function projectedCash(m){
    if(state.settings.openingCash===null || !validMonth(state.settings.openingMonth) || monthIndex(m)<monthIndex(state.settings.openingMonth)) return null;
    let balance=state.settings.openingCash;
    const months=Math.min(241,monthIndex(m)-monthIndex(state.settings.openingMonth)+1);
    for(let i=0;i<months;i++) balance+=summary(shiftMonth(state.settings.openingMonth,i)).net;
    return balance;
  }
  function eventRows(events,limited=false){
    const src=limited?events.slice(0,5):events;
    if(!src.length) return `<div class="wide-empty"><span class="empty-emoji">🗓</span><strong>Bu ay için planlanan hareket yok</strong><p>Gelirini, kredi taksitini veya kart alışverişlerini ekleyerek takvimi oluştur.</p><button class="primary-button" data-action="add-menu">İlk kaydını ekle</button></div>`;
    return `<div class="item-list">${src.map(e=>{
      const paid=!!state.paid[e.id];
      return `<div class="event ${paid?'event-done':''}"><div class="event-day"><strong>${Number(e.date.slice(8))}</strong><small>${esc(shortMonth(e.date.slice(0,7)).toUpperCase())}</small></div><div class="event-desc"><div class="event-name">${esc(e.label)}</div><div class="event-meta">${esc(e.note)}${paid?' • '+(e.type==='income'?'Alındı':'Ödendi'):''}</div></div><div class="event-right"><div class="event-value ${e.type==='income'?'income':''}">${e.type==='income'?'+':'−'}${money(e.amount)}</div><button class="check-dot ${paid?'checked':''}" data-action="toggle-paid" data-id="${esc(e.id)}" aria-label="${paid?'İşaretlemeyi kaldır':'Ödendi veya alındı olarak işaretle'}" title="${paid?'İşaretlemeyi kaldır':e.type==='income'?'Alındı olarak işaretle':'Ödendi olarak işaretle'}">${paid?'✓':''}</button></div></div>`;
    }).join('')}</div>`;
  }
  function emptyState(title,text,action,label){return `<div class="wide-empty"><span class="empty-emoji">✦</span><strong>${esc(title)}</strong><p>${esc(text)}</p><button class="primary-button" data-action="${action}">${esc(label)}</button></div>`;}
  function dashboard(){
    const s=summary(selectedMonth);
    const goal=state.settings.savingsTarget||0;
    const incomePercent=s.out>0?s.card/s.out*100:0;
    const loanPercent=s.out>0?s.loan/s.out*100:0;
    const otherPercent=s.out>0?s.other/s.out*100:0;
    const cash=projectedCash(selectedMonth);
    const tallest=Math.max(100,...Array.from({length:6},(_,i)=>{const v=summary(shiftMonth(selectedMonth,i));return Math.max(v.income,v.out);}));
    const chart=Array.from({length:6},(_,i)=>{
      const m=shiftMonth(selectedMonth,i);const v=summary(m);
      return `<div class="chart-col" title="${esc(prettyMonth(m))} — gelir ${money(v.income)}, gider ${money(v.out)}"><div class="chart-bars"><div class="chart-bar bar-income" style="height:${Math.max(2,v.income/tallest*100)}%"></div><div class="chart-bar bar-out" style="height:${Math.max(2,v.out/tallest*100)}%"></div></div><span class="chart-label">${esc(shortMonth(m))}</span></div>`;
    }).join('');
    const nextRows=Array.from({length:3},(_,i)=>{
      const m=shiftMonth(selectedMonth,i+1),v=summary(m);
      return `<div class="forecast-row"><strong>${esc(prettyMonth(m))}</strong><span>Kart ${money(v.card)}</span><b class="${v.available>=0?'accent-green':'accent-red'}">${money(v.available)} serbest</b></div>`;
    }).join('');
    return `<section class="main-grid"><article class="hero"><div class="mini-label">✧ &nbsp; ${esc(prettyMonth(selectedMonth))} · Planlanan serbest bütçe</div><div class="hero-amount">${money(s.available)}</div><div class="hero-sub">Aylık beklenen gelirinden kart ödemeleri, krediler, sabit giderler ve ${money(goal)} birikim hedefi düşülmüştür. Gerçek banka bakiyen değildir.</div><div class="hero-footer"><span class="small-pill">${s.available>=0?'✦ Plan içinde':'! Bütçe açığı görünüyor'}</span><button data-action="add-menu">+ Yeni kayıt</button></div></article><article class="panel outflow-panel"><div class="panel-top"><div><h2 class="panel-title">Bu ayın gider dağılımı</h2><p class="panel-subtitle">Toplam planlanan ödeme</p></div><span class="item-chip">${esc(shortMonth(selectedMonth))}</span></div><div class="outflow-total">${money(s.out)}</div><div class="outflow-bars">${s.out?`<span style="width:${incomePercent}%;background:#72b1ed"></span><span style="width:${loanPercent}%;background:#8ce8c9"></span><span style="width:${otherPercent}%;background:#f6b17c"></span>`:''}</div><div class="legend"><div class="legend-item"><i class="legend-swatch" style="background:#72b1ed"></i><div><div class="legend-title">Kredi kartları</div><div class="legend-value">${money(s.card)}</div></div></div><div class="legend-item"><i class="legend-swatch" style="background:#8ce8c9"></i><div><div class="legend-title">Krediler</div><div class="legend-value">${money(s.loan)}</div></div></div><div class="legend-item"><i class="legend-swatch" style="background:#f6b17c"></i><div><div class="legend-title">Diğer giderler</div><div class="legend-value">${money(s.other)}</div></div></div><div class="legend-item"><i class="legend-swatch" style="background:#a99aff"></i><div><div class="legend-title">Birikim hedefi</div><div class="legend-value">${money(goal)}</div></div></div></div></article></section>
    <section class="stats-grid"><div class="metric"><div class="metric-label">BEKLENEN GELİR</div><div class="metric-value accent-green">${money(s.income)}</div><div class="metric-caption">Bu ayın toplamı</div></div><div class="metric"><div class="metric-label">KART ÖDEMELERİ</div><div class="metric-value">${money(s.card)}</div><div class="metric-caption">Son ödeme tarihlerinde</div></div><div class="metric"><div class="metric-label">HENÜZ İŞARETLENMEYEN</div><div class="metric-value ${s.unpaid>0?'accent-red':''}">${money(s.unpaid)}</div><div class="metric-caption">Ödendi olarak işaretlenmemiş</div></div><div class="metric"><div class="metric-label">AY SONU NAKİT TAHMİNİ</div><div class="metric-value">${cash===null?'—':money(cash)}</div><div class="metric-caption">${cash===null?'Açılış bakiyesi girilmedi':'Girilen nakit + planlanan hareketler'}</div></div></section>
    <section class="content-grid"><article class="panel"><div class="panel-top"><div><h2 class="panel-title">Yaklaşan ödeme takvimi</h2><p class="panel-subtitle">Seçilen ayın planlanan hareketleri</p></div><button class="inline-button" data-tab="calendar">Tümünü gör</button></div>${eventRows(s.events,true)}</article><div class="stack"><article class="panel"><div class="panel-top"><div><h2 class="panel-title">6 aylık nakit planı</h2><p class="panel-subtitle">Gelir ve ödemeleri karşılaştır</p></div></div><div class="chart-block">${chart}</div><div class="chart-legend"><span><i style="background:#52d5b6"></i>Gelir</span><span><i style="background:#eb9d96"></i>Gider</span></div><div class="forecast-table"><div class="forecast-caption">GELECEK 3 AY</div>${nextRows}</div></article><article class="panel"><h2 class="panel-title">Hızlı işlemler</h2><div class="quick-actions"><button class="quick-action" data-action="add-installment"><strong>▰</strong>Taksit ekle</button><button class="quick-action" data-action="add-recurring" data-kind="income"><strong>↗</strong>Gelir ekle</button><button class="quick-action" data-action="add-recurring" data-kind="expense"><strong>⌂</strong>Kredi / gider</button></div><div class="hint">Ödemeleri gerçekleşince işaretleyebilirsin. Bunlar bankanla otomatik senkronize olmaz.</div></article></div></section>`;
  }
  function calendar(){
    const s=summary(selectedMonth);
    const remainingIncome=s.events.filter(e=>e.type==='income'&&!state.paid[e.id]).reduce((a,b)=>a+b.amount,0);
    const nextMonths=Array.from({length:12},(_,i)=>{const m=shiftMonth(selectedMonth,i);const x=summary(m);return `<tr><td>${esc(prettyMonth(m))}</td><td>${money(x.income)}</td><td>${money(x.card)}</td><td>${money(x.out)}</td><td class="${x.net>=0?'accent-green':'accent-red'}">${money(x.net)}</td></tr>`;}).join('');
    return `<section class="calendar-summary"><div class="metric"><div class="metric-label">TOPLAM PLANLANAN ÖDEME</div><div class="metric-value">${money(s.out)}</div></div><div class="metric"><div class="metric-label">ÖDENDİ OLARAK İŞARETLENMEMİŞ</div><div class="metric-value accent-red">${money(s.unpaid)}</div></div><div class="metric"><div class="metric-label">ALINDI OLARAK İŞARETLENMEMİŞ GELİR</div><div class="metric-value accent-green">${money(remainingIncome)}</div></div></section><article class="panel"><div class="panel-top"><div><h2 class="panel-title">${esc(prettyMonth(selectedMonth))} ödeme takvimi</h2><p class="panel-subtitle">Gününe göre sıralandı · Daireye basıp ödendi/alındı olarak işaretle</p></div><button class="button-secondary" data-action="add-menu">+ Ekle</button></div>${eventRows(s.events)}</article><section class="top-gap panel"><h2 class="panel-title">Önümüzdeki 12 ay · Plan tablosu</h2><p class="panel-subtitle">Kart taksitlerinin aylık yükü ve bütçe fazlası / açığı</p><div style="overflow:auto;margin-top:12px"><table class="simple-table" style="min-width:500px"><thead><tr><th>Ay</th><th>Gelir</th><th>Kart</th><th>Toplam gider</th><th>Net</th></tr></thead><tbody>${nextMonths}</tbody></table></div></section>`;
  }
  function cards(){
    const cardsMarkup=state.cards.length?`<div class="cards-grid">${state.cards.map(card=>{
      const amount=state.installments.filter(t=>t.cardId===card.id).reduce((sum,t)=>sum+getInstallmentAmount(t,selectedMonth),0);
      const count=state.installments.filter(t=>t.cardId===card.id).length;
      return `<article class="card-tile"><div class="credit-top"><span class="credit-icon">▰</span><div class="small-actions"><button class="credit-action" data-action="edit" data-type="card" data-id="${esc(card.id)}">Düzenle</button></div></div><div class="credit-name">${esc(card.name)}</div><div class="credit-meta">${card.last4?'•••• '+esc(card.last4)+' · ':''}Kesim: ${card.closingDay}. gün · Son ödeme: ${card.dueDay}. gün</div><div class="credit-bottom"><div><div class="credit-meta">${esc(prettyMonth(selectedMonth))} taksitleri</div><div class="credit-total">${money(amount)}</div></div><span class="item-chip">${count} kayıt</span></div></article>`;
    }).join('')}</div>`:emptyState('Henüz kart eklemedin','Bankanın ismini, kesim gününü ve son ödeme gününü gir. Tam kart numarası gerekmez.','add-card','İlk kartını ekle');
    const upcoming=state.installments.slice().sort((a,b)=>monthIndex(lastDue(a))-monthIndex(lastDue(b)));
    return `<div class="section-heading"><div><h2>Kredi kartlarım</h2><p>Bu ayın beklenen ekstresi ve ödeme günleri</p></div><button class="button-secondary" data-action="add-card">+ Kart ekle</button></div>${cardsMarkup}<div class="section-heading"><div><h2>Taksit takip listesi</h2><p>Her alışverişin bitiş ayını ve kalan taksit sayısını gör</p></div><button class="button-secondary" data-action="add-installment">+ Taksit ekle</button></div>${upcoming.length?`<div class="cards-grid">${upcoming.map(t=>{
      const card=getCard(t.cardId);const passed=Math.max(0,Math.min(t.count,monthIndex(selectedMonth)-monthIndex(t.firstDueMonth)));
      const current=monthIndex(selectedMonth)>=monthIndex(t.firstDueMonth)&&monthIndex(selectedMonth)<=monthIndex(lastDue(t));
      const remaining=Math.max(0,t.count-passed);
      return `<article class="schedule-card"><div class="schedule-top"><div><div class="schedule-title">${esc(t.title)}</div><div class="schedule-meta">${esc(card?.name||'Silinmiş kart')} · ${t.count} taksit<br>Bitiş: <strong>${esc(prettyMonth(lastDue(t)))}</strong></div></div><div class="schedule-amount">${money(t.total)}</div></div><div class="progress-bar"><span style="width:${(passed/t.count*100).toFixed(1)}%"></span></div><div class="schedule-footer"><span>${remaining} planlanan taksit ${current?`· Bu ay ${money(getInstallmentAmount(t,selectedMonth))}`:''}</span><div class="small-actions"><button class="link-button" data-action="edit" data-type="installment" data-id="${esc(t.id)}">Düzenle</button><button class="link-button danger" data-action="delete" data-type="installment" data-id="${esc(t.id)}">Sil</button></div></div></article>`;
    }).join('')}</div>`:emptyState('Henüz taksit kaydı yok','Kart harcamalarını toplam tutar, taksit adedi ve ilk ödeme ayıyla ekleyebilirsin.','add-installment','Taksit ekle')}
    <div class="note top-gap"><strong>Ekstre hesaplama notu:</strong> Buradaki tutarlar, belirlediğin “ilk ödeme ayı” esas alınarak tahmin edilir. Bankaların kesim günü, erteleme, kampanya, faiz, asgari ödeme ve kuruş yuvarlama uygulamaları farklı olabilir. Banka ekstreni doğrula.</div>`;
  }
  function recordRow(item,type){
    const isCard=type==='card'; const isInst=type==='installment'; const isOne=type==='oneoff';
    const title=item.title||item.name;
    const desc=isCard?`Kesim ${item.closingDay}. gün · Son ödeme ${item.dueDay}. gün`:isInst?`${esc(getCard(item.cardId)?.name||'Kart silinmiş')} · ${item.count} taksit · ${esc(prettyMonth(item.firstDueMonth))}–${esc(prettyMonth(lastDue(item)))}`:isOne?`${displayDate(item.date)} · ${item.type==='income'?'Gelir':'Gider'}`:`${item.type==='income'?'Gelir':item.category==='loan'?'Kredi': 'Sabit gider'} · Her ayın ${item.day}. günü · ${esc(prettyMonth(item.startMonth))}${item.endMonth?'–'+esc(prettyMonth(item.endMonth)): ' → Süresiz'}`;
    const amount=isCard?null:isInst?item.total:item.amount;
    return `<div class="record-row"><div class="record-icon">${isCard?'▰':isInst?'◫':item.type==='income'?'↗':(item.category==='loan'?'⌂':'↓')}</div><div class="record-info"><div class="record-name">${esc(title)}</div><div class="record-desc">${desc}</div></div><div class="record-value">${amount!==null?`<strong class="record-amount ${item.type==='income'?'accent-green':''}">${money(amount)}</strong>`:''}<div class="record-actions"><button class="link-button" data-action="edit" data-type="${type}" data-id="${esc(item.id)}">Düzenle</button><button class="link-button danger" data-action="delete" data-type="${type}" data-id="${esc(item.id)}">Sil</button></div></div></div>`;
  }
  function records(){
    const groups=[['Kredi ve düzenli gelir / gider',state.recurring,'recurring'],['Kart taksitleri / alışverişler',state.installments,'installment'],['Tek seferlik nakit işlemleri',state.oneoffs,'oneoff'],['Kredi kartları',state.cards,'card']];
    return `<section class="panel"><div class="panel-top"><div><h2 class="panel-title">Bütün kayıtlarım</h2><p class="panel-subtitle">Her kaydı buradan düzenleyebilir veya silebilirsin</p></div><button class="button-secondary" data-action="add-menu">+ Ekle</button></div>${groups.map(([label,arr,type])=>`<div class="record-group"><div class="record-group-title">${label} <span class="item-chip">${arr.length}</span></div>${arr.length?arr.map(x=>recordRow(x,type)).join(''):'<div class="details-mini" style="padding:18px 4px">Henüz kayıt yok.</div>'}</div>`).join('')}</section>`;
  }
  function settings(){
    const s=state.settings;
    return `<div class="settings-grid"><article class="panel"><h2 class="panel-title">Nakit başlangıcı ve birikim</h2><p class="panel-subtitle">Ay sonu nakit tahmini için açılış bakiyeni belirle. Bakiye seçtiğin ayın <strong>ilk gününe</strong> ait olmalı.</p><div class="record-group"><div class="record-group-title">Nakit açılış ayı</div><div class="setting-value">${esc(prettyMonth(s.openingMonth))}</div></div><div class="record-group"><div class="record-group-title">Ay başındaki toplam nakit</div><div class="setting-value">${s.openingCash===null?'Belirlenmedi':money(s.openingCash)}</div></div><div class="record-group"><div class="record-group-title">Aylık birikim hedefi</div><div class="setting-value accent-green">${money(s.savingsTarget)}</div></div><button class="primary-button" data-action="edit-settings">Bu bilgileri düzenle</button></article><article class="panel"><h2 class="panel-title">Verilerim ve yedekleme</h2><p class="panel-subtitle">Uygulama bankana bağlanmaz, internet üzerinden finans bilgisi göndermez. Kayıtların bu tarayıcı/profilin yerel depolamasındadır.</p><div class="stack top-gap"><button class="button-secondary" data-action="export">↓ JSON yedeğini indir</button><button class="button-secondary" data-action="import">↑ JSON yedeğinden geri yükle</button><button class="button-secondary" data-action="demo">◇ Örnek verilerle dene</button><button class="button-secondary" style="color:#ff9dac" data-action="clear-data">✕ Tüm kayıtlarımı sil</button></div><input type="file" id="import-file" accept="application/json,.json" style="display:none" aria-label="JSON yedeğini seç"><div class="hint"><strong>Önemli:</strong> Tarayıcı verilerini silersen veya telefonu değiştirirsen kayıtlar kaybolabilir. Düzenli yedek al. Finans verilerin cihazda şifresiz yerel depolamada tutulur; cihaz kilidini kullan ve yedeğini güvenli sakla. Kart numarası, CVV ve banka şifresi kaydetme.</div></article></div><div class="note top-gap"><strong>Hesaplama prensibi:</strong> Serbest bütçe = seçilen ayın beklenen geliri − planlı kredi/kart/diğer ödemeler − aylık birikim hedefi. Ay sonu nakit tahmini ise belirttiğin açılış bakiyesine bu hareketleri kümülatif ekler. Yalnızca kaydettiğin işlemler hesaba katılır; gerçek hesap bakiyesi değildir.</div>`;
  }
  function render(){
    const title={dashboard:'Para kontrolü sende.',calendar:'Ödemeleri önden gör.',cards:'Taksitleri takip et.',records:'Her şey kayıt altında.',settings:'Kontrol tamamen sende.'};
    el('page-title').textContent=title[tab];
    el('month-label').textContent=prettyMonth(selectedMonth);
    el('greeting').textContent=tab==='dashboard'?'FİNANS GÖRÜNÜMÜ':tab==='calendar'?'ÖDEME TAKVİMİ':tab==='cards'?'KREDİ KARTLARIM':tab==='records'?'KAYIT YÖNETİMİ':'GİZLİLİK VE PLANLAMA';
    document.querySelectorAll('.nav-btn').forEach(btn=>{const active=btn.dataset.tab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-current',active?'page':'false');});
    el('content').innerHTML=({dashboard,calendar,cards,records,settings}[tab])();
    el('previous-month').disabled=monthIndex(selectedMonth)<=2020*12;
    el('next-month').disabled=monthIndex(selectedMonth)>=2040*12;
  }
  const textField=(name,label,value='',extra='')=>`<div class="field ${extra.includes('wide')?'full':''}"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="text" value="${esc(value)}" ${extra.replace('wide','')} ${name==='last4'?'':'required'}></div>`;
  const amountField=(name,label,value,extra='')=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="text" inputmode="decimal" autocomplete="off" placeholder="Örn. 2500,00" value="${esc(numberInput(value))}" ${extra} required></div>`;
  const monthField=(name,label,value,required=true)=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="month" value="${esc(value||'')}" ${required?'required':''}></div>`;
  const dayField=(name,label,value)=>`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="number" min="1" max="31" value="${esc(value)}" required></div>`;
  const selectField=(name,label,choices,value)=>`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}" required>${choices.map(([k,v])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`;
  function modalTemplate(kind,id){
    let item = id ? ({card:state.cards,installment:state.installments,recurring:state.recurring,oneoff:state.oneoffs}[kind]||[]).find(e=>e.id===id) : null;
    if(id&&!item) return null;
    let heading='', fields='',hint='';
    if(kind==='card'){
      heading=item?'Kartı düzenle':'Yeni kredi kartı';
      fields=`${textField('name','Kart adı (takma ad)',item?.name||'','placeholder="Örn. İş Bankası Maximum" wide')}${textField('last4','Son 4 hane (isteğe bağlı)',item?.last4||'','maxlength="4" inputmode="numeric" placeholder="1234"')}${dayField('closingDay','Ekstre kesim günü',item?.closingDay||1)}${dayField('dueDay','Son ödeme günü',item?.dueDay||10)}`;
      hint='Tam kart numaranı, CVV veya banka şifreni girme. Ödeme günü ayın sonunu aşarsa ayın son günü kullanılır.';
    } else if(kind==='installment'){
      heading=item?'Alışverişi düzenle':'Yeni kart alışverişi / taksit';
      fields=`${textField('title','Alışveriş / taksit açıklaması',item?.title||'','placeholder="Örn. Telefon / Market" wide')}${selectField('cardId','Hangi kart?',state.cards.map(c=>[c.id,c.name]),item?.cardId||state.cards[0]?.id)}${amountField('total','Toplam alışveriş tutarı (₺)',item?.total)}<div class="field"><label for="f-count">Taksit adedi</label><input id="f-count" name="count" type="number" min="1" max="240" value="${esc(item?.count||1)}" required></div>${monthField('firstDueMonth','İlk ödeme ayı',item?.firstDueMonth||selectedMonth)}`;
      hint='Önemli: Toplam alışveriş tutarını gir. Örn. 12.000 ₺, 6 taksit → 2.000 ₺/ay. “İlk ödeme ayı”, kart ekstresinde ilk kez ödeyeceğin aydır; satın alma ayı olmak zorunda değildir.';
    } else if(kind==='recurring'){
      heading=item?'Düzenli kaydı düzenle':'Düzenli gelir / gider ekle';
      fields=`${textField('title','Açıklama',item?.title||'','placeholder="Örn. Maaş / Konut kredisi" wide')}${selectField('type','Hareket türü',[['income','Gelir'],['expense','Gider']],item?.type||'expense')}${selectField('category','Gider tipi',[['loan','Kredi taksiti'],['fixed','Fatura / sabit gider'],['other','Diğer']],item?.category||'loan')}${amountField('amount','Her ay tutar (₺)',item?.amount)}${dayField('day','Her ayın kaçında?',item?.day||15)}${monthField('startMonth','İlk ödeme / gelir ayı',item?.startMonth||selectedMonth)}${monthField('endMonth','Son ay (boş = süresiz)',item?.endMonth||'',false)}`;
      hint='Konut kredisi gibi belirli vadeli ödemelerde “son ay”ı da girersen bitiş tarihini otomatik izlersin. Gelir için gider tipi dikkate alınmaz.';
    } else if(kind==='oneoff'){
      heading=item?'Tek seferlik kaydı düzenle':'Tek seferlik nakit hareketi';
      fields=`${textField('title','İşlem açıklaması',item?.title||'','placeholder="Örn. Nakit alışveriş / Ek gelir" wide')}${selectField('type','Hareket türü',[['expense','Gider'],['income','Gelir']],item?.type||'expense')}${amountField('amount','Tutar (₺)',item?.amount)}<div class="field"><label for="f-date">İşlem tarihi</label><input id="f-date" name="date" type="date" value="${esc(item?.date||monthDay(selectedMonth,1))}" required></div>`;
      hint='Nakit / banka hesabından tek seferde çıkan veya giren tutarlar içindir. Kredi kartı alışverişlerini “Taksit ekle” bölümünden gir; aksi halde iki kez sayılabilir.';
    } else if(kind==='settings'){
      heading='Bütçe temel ayarları';
      fields=`${monthField('openingMonth','Nakit açılış ayı',state.settings.openingMonth)}<div class="field"><label for="f-openingCash">O ayın 1’indeki mevcut nakit (₺)</label><input id="f-openingCash" name="openingCash" type="text" inputmode="decimal" placeholder="Boş bırakırsan tahmin yapılmaz" value="${esc(numberInput(state.settings.openingCash))}"></div>${amountField('savingsTarget','Her ay ayırmak istediğin birikim (₺)',state.settings.savingsTarget)}`;
      hint='Açılış bakiyesi seçtiğin ayın ilk gününe ait olmalıdır. Maaş ve krediler hesaplamaya o ayın hareketleri olarak eklenir. Birikim hedefi serbest bütçeden düşer fakat gerçek nakit çıkışı olarak sayılmaz.';
    } else return null;
    return `<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(heading)}"><div class="modal-header"><h2>${esc(heading)}</h2><button class="modal-close" data-action="close-modal" aria-label="Kapat">×</button></div><form id="edit-form" data-kind="${kind}" data-id="${esc(id||'')}"><div class="form-grid">${fields}</div><div class="hint">${esc(hint)}</div><div id="form-error"></div><div class="modal-footer"><button type="button" class="button-secondary" data-action="close-modal">Vazgeç</button><button type="submit" class="primary-button">Kaydet</button></div></form></section>`;
  }
  function openModal(kind,id){
    if(kind==='installment'&&!state.cards.length){tab='cards';render();toast('Önce bir kredi kartı eklemelisin.');kind='card';}
    const markup=modalTemplate(kind,id);
    if(!markup){toast('Kayıt bulunamadı.');return;}
    el('modal-root').innerHTML=markup;el('modal-root').classList.add('open');
    document.body.style.overflow='hidden';
    setTimeout(()=>el('modal-root').querySelector('input')?.focus(),80);
  }
  function closeModal(){el('modal-root').classList.remove('open');el('modal-root').innerHTML='';document.body.style.overflow='';}
  function formError(message){el('form-error').innerHTML=`<div class="form-error">${esc(message)}</div>`;}
  function submitForm(form){
    const kind=form.dataset.kind, id=form.dataset.id;
    const data=Object.fromEntries(new FormData(form).entries());
    const getAmount=(key,allowBlank=false)=>{const val=allowBlank&&!String(data[key]||'').trim()?null:parseAmount(data[key]);if(val===null)return val;if(!Number.isInteger(val)||(val<=0&&key!=='savingsTarget'&&key!=='openingCash'))throw Error('Tutarı sıfırdan büyük, geçerli bir sayı olarak gir.');return val;};
    try{
      if(kind==='settings'){
        if(!validMonth(data.openingMonth))throw Error('Geçerli bir açılış ayı seç.');
        state.settings={openingMonth:data.openingMonth,openingCash:getAmount('openingCash',true),savingsTarget:getAmount('savingsTarget')};
      } else {
        let record={id:id||newId()};
        if(kind==='card'){
          const name=data.name.trim(),last4=String(data.last4||'').trim();
          if(!name||name.length>80)throw Error('Kart adı 1–80 karakter olmalı.');
          if(last4&&!/^\d{4}$/.test(last4))throw Error('Son 4 hane yalnızca dört rakam olmalı.');
          const closingDay=Number(data.closingDay),dueDay=Number(data.dueDay);
          if(!Number.isInteger(closingDay)||closingDay<1||closingDay>31||!Number.isInteger(dueDay)||dueDay<1||dueDay>31)throw Error('Günler 1–31 arasında olmalı.');
          Object.assign(record,{name,last4,closingDay,dueDay});
        } else if(kind==='installment'){
          const title=data.title.trim(),count=Number(data.count),total=getAmount('total');
          if(!title||title.length>100)throw Error('Açıklama 1–100 karakter olmalı.');
          if(!getCard(data.cardId))throw Error('Geçerli bir kredi kartı seç.');
          if(!Number.isInteger(count)||count<1||count>240)throw Error('Taksit sayısı 1–240 arasında olmalı.');
          if(!validMonth(data.firstDueMonth))throw Error('İlk ödeme ayını seç.');
          Object.assign(record,{title,cardId:data.cardId,total,count,firstDueMonth:data.firstDueMonth});
        } else if(kind==='recurring'){
          const title=data.title.trim(),amount=getAmount('amount'),day=Number(data.day);
          if(!title||title.length>100)throw Error('Açıklama 1–100 karakter olmalı.');
          if(!['income','expense'].includes(data.type))throw Error('Hareket türü geçersiz.');
          if(!Number.isInteger(day)||day<1||day>31)throw Error('Gün 1–31 arasında olmalı.');
          if(!validMonth(data.startMonth)||(data.endMonth&&(!validMonth(data.endMonth)||monthIndex(data.endMonth)<monthIndex(data.startMonth))))throw Error('Başlangıç ve bitiş aylarını kontrol et.');
          Object.assign(record,{title,amount,day,type:data.type,category:data.type==='income'?'other':data.category,startMonth:data.startMonth,endMonth:data.endMonth||''});
        } else if(kind==='oneoff'){
          const title=data.title.trim(),amount=getAmount('amount');
          if(!title||title.length>100)throw Error('Açıklama 1–100 karakter olmalı.');
          if(!['income','expense'].includes(data.type))throw Error('Hareket türü geçersiz.');
          if(!/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(data.date)||new Date(data.date+'T12:00:00').toISOString().slice(0,10)!==data.date)throw Error('Geçerli bir işlem tarihi seç.');
          Object.assign(record,{title,amount,type:data.type,date:data.date});
        }
        const arr=({card:state.cards,installment:state.installments,recurring:state.recurring,oneoff:state.oneoffs})[kind];
        if(!arr)throw Error('Bilinmeyen kayıt türü.');
        const previous = id ? arr.find(v=>v.id===id) : null;
        if(id){const idx=arr.findIndex(v=>v.id===id);if(idx<0)throw Error('Düzenlenecek kayıt bulunamadı.');arr[idx]=record;}else arr.push(record);
        // Değişen tahakkuk takvimlerinde eski ödeme işaretlerini sıfırla.
        if(id){
          const affectedCards = kind==='installment' ? [record.cardId, previous?.cardId] : [];
          for(const key of Object.keys(state.paid)) {
            if((kind==='recurring' && key.startsWith(`rec:${id}:`)) ||
               (kind==='oneoff' && key===`once:${id}`) ||
               (kind==='card' && key.startsWith(`card:${id}:`)) ||
               (kind==='installment' && affectedCards.some(cid=>cid&&key.startsWith(`card:${cid}:`)))) delete state.paid[key];
          }
        }
      }
      closeModal();save();toast('Kayıt kaydedildi.');
    }catch(err){formError(err.message||'Kayıt kaydedilemedi.');}
  }
  function removeItem(kind,id){
    const arr=({card:state.cards,installment:state.installments,recurring:state.recurring,oneoff:state.oneoffs})[kind];if(!arr)return;
    const item=arr.find(i=>i.id===id);if(!item)return;
    const linked=kind==='card'?state.installments.filter(t=>t.cardId===id).length:0;
    const warning=linked?`\nBu karta bağlı ${linked} alışveriş/taksit kaydı da silinecek.`:'';
    if(!confirm(`“${item.title||item.name}” kaydını silmek istiyor musun?${warning}`))return;
    arr.splice(arr.findIndex(i=>i.id===id),1);
    if(kind==='card')state.installments=state.installments.filter(t=>t.cardId!==id);
    for(const key of Object.keys(state.paid)) {
      if((kind==='recurring'&&key.startsWith(`rec:${id}:`)) ||
         (kind==='oneoff'&&key===`once:${id}`) ||
         (kind==='card'&&key.startsWith(`card:${id}:`)) ||
         (kind==='installment'&&key.startsWith(`card:${item.cardId}:`)))delete state.paid[key];
    }
    save();toast('Kayıt silindi.');
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString()},null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download=`akis-finans-yedek-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    toast('Yedek dosyan indirildi.');
  }
  function validateBackup(x){
    if(!x||x.version!==1||!Array.isArray(x.cards)||!Array.isArray(x.installments)||!Array.isArray(x.recurring)||!Array.isArray(x.oneoffs)||!x.settings||typeof x.paid!=='object'||x.paid===null||Array.isArray(x.paid))throw Error('Bu dosya geçerli bir Akış yedeği değil.');
    if(x.cards.length+x.installments.length+x.recurring.length+x.oneoffs.length>10000)throw Error('Yedekte çok fazla kayıt var.');
    const validId=id=>typeof id==='string'&&id.length>0&&id.length<=100;
    const validTitle=t=>typeof t==='string'&&t.trim().length>0&&t.length<=200;
    const validMoney=n=>Number.isSafeInteger(n)&&n>0&&n<=100000000000000;
    const validDay=d=>Number.isInteger(d)&&d>=1&&d<=31;
    const validDate=d=>typeof d==='string'&&/^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
    for(const card of x.cards){if(!validId(card.id)||!validTitle(card.name)||!validDay(card.dueDay)||!validDay(card.closingDay)||(card.last4&&!/^\d{4}$/.test(card.last4)))throw Error('Kart kaydı bozuk.');}
    const cardIds=new Set(x.cards.map(c=>c.id));
    for(const t of x.installments){if(!validId(t.id)||!validTitle(t.title)||!cardIds.has(t.cardId)||!validMoney(t.total)||!Number.isInteger(t.count)||t.count<1||t.count>240||!validMonth(t.firstDueMonth))throw Error('Taksit kaydı bozuk.');}
    for(const r of x.recurring){if(!validId(r.id)||!validTitle(r.title)||!validMoney(r.amount)||!validDay(r.day)||!validMonth(r.startMonth)||(r.endMonth&&(!validMonth(r.endMonth)||monthIndex(r.endMonth)<monthIndex(r.startMonth)))||!['income','expense'].includes(r.type)||!['loan','fixed','other'].includes(r.category))throw Error('Düzenli işlem kaydı bozuk.');}
    for(const o of x.oneoffs){if(!validId(o.id)||!validTitle(o.title)||!validMoney(o.amount)||!validDate(o.date)||!['income','expense'].includes(o.type))throw Error('Nakit kaydı bozuk.');}
    if(!validMonth(x.settings.openingMonth)||!Number.isSafeInteger(x.settings.savingsTarget)||x.settings.savingsTarget<0||x.settings.savingsTarget>100000000000000||!(x.settings.openingCash===null||(Number.isSafeInteger(x.settings.openingCash)&&x.settings.openingCash>=0)))throw Error('Bütçe ayarları bozuk.');
    return {version:1,cards:x.cards,installments:x.installments,recurring:x.recurring,oneoffs:x.oneoffs,paid:x.paid,settings:x.settings};
  }
  function demoData(){
    const a=newId(),b=newId(),start=selectedMonth;
    state={version:1,cards:[{id:a,name:'ÖRNEK · Mavi Kart',last4:'',closingDay:5,dueDay:15},{id:b,name:'ÖRNEK · Yeşil Kart',last4:'',closingDay:12,dueDay:22}],installments:[{id:newId(),title:'ÖRNEK · Laptop',cardId:a,total:2400000,count:6,firstDueMonth:start},{id:newId(),title:'ÖRNEK · Market',cardId:b,total:450000,count:1,firstDueMonth:start}],recurring:[{id:newId(),title:'ÖRNEK · Maaş',amount:6000000,day:1,type:'income',category:'other',startMonth:start,endMonth:''},{id:newId(),title:'ÖRNEK · Konut kredisi',amount:1500000,day:15,type:'expense',category:'loan',startMonth:start,endMonth:shiftMonth(start,23)},{id:newId(),title:'ÖRNEK · Faturalar',amount:350000,day:19,type:'expense',category:'fixed',startMonth:start,endMonth:''}],oneoffs:[],paid:{},settings:{openingCash:2000000,openingMonth:start,savingsTarget:500000}};
    tab='dashboard';save();toast('Örnek veri yüklendi · Kendi rakamların değildir.');
  }
  function showMenu(){
    const root=el('modal-root');
    root.innerHTML=`<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true" aria-label="Yeni kayıt"><div class="modal-header"><h2>Ne eklemek istiyorsun?</h2><button class="modal-close" data-action="close-modal" aria-label="Kapat">×</button></div><div class="stack"><button class="quick-action" data-action="add-card">▰ &nbsp; Yeni kredi kartı</button><button class="quick-action" data-action="add-installment">◫ &nbsp; Kredi kartı taksiti / alışveriş</button><button class="quick-action" data-action="add-recurring" data-kind="income">↗ &nbsp; Düzenli maaş / gelir</button><button class="quick-action" data-action="add-recurring" data-kind="expense">⌂ &nbsp; Konut kredisi / sabit gider</button><button class="quick-action" data-action="add-oneoff">↓ &nbsp; Tek seferlik nakit gelir / gider</button></div></section>`;
    root.classList.add('open');document.body.style.overflow='hidden';
  }
  function showHelp(){
    el('modal-root').innerHTML=`<div class="modal-backdrop" data-action="close-modal"></div><section class="modal" role="dialog" aria-modal="true" aria-label="Akış hakkında"><div class="modal-header"><h2>Akış nasıl çalışır?</h2><button class="modal-close" data-action="close-modal" aria-label="Kapat">×</button></div><div class="details-mini"><p><strong>1.</strong> Önce kartlarını ve kart son ödeme günlerini tanımla.</p><p><strong>2.</strong> Her kredi kartı alışverişini toplam tutarı, taksit sayısı ve ilk ekstre ödeme ayıyla kaydet.</p><p><strong>3.</strong> Maaşını ve kredi taksitini “Düzenli gelir / gider” olarak ekle. Kredinin son ayını gir.</p><p><strong>4.</strong> Özet sayfasında her ay ne kadar serbest bütçe kaldığını, Takvim'de ödeme günlerini, Kartlar'da taksitlerin bitişini gör.</p><p><strong>5.</strong> Gerçekleşen kalemleri Takvim'de işaretle. Ay başı nakit bakiyeni Ayarlar'dan girersen tahmini ay sonu nakdini de görebilirsin.</p><p><strong>Gizlilik:</strong> Banka bağlantısı ve sunucu yoktur. Bu cihazda tutulur. Ayarlardan dışa aktararak yedekle.</p><p><strong>Uyarı:</strong> Finansal tahmin uygulamasıdır; banka ekstren ile doğrula. Kart asgari tutar, faiz veya gecikme hesaplamaz.</p></div><div class="modal-footer"><button class="primary-button" data-action="close-modal">Anladım</button></div></section>`;
    el('modal-root').classList.add('open');document.body.style.overflow='hidden';
  }
  document.addEventListener('click',(ev)=>{
    const nav=ev.target.closest('[data-tab]');
    if(nav){tab=nav.dataset.tab;render();window.scrollTo({top:0,behavior:'smooth'});return;}
    const btn=ev.target.closest('[data-action]');if(!btn)return;
    const act=btn.dataset.action;
    if(act==='close-modal'){closeModal();return;}
    if(act==='show-help'){showHelp();return;}
    if(act==='add-menu'){showMenu();return;}
    if(act==='add-card'){openModal('card');return;}
    if(act==='add-installment'){openModal('installment');return;}
    if(act==='add-recurring'){openModal('recurring');
      if(btn.dataset.kind==='income'){const s=el('f-type');if(s)s.value='income';const cat=el('f-category');if(cat)cat.value='other';}
      return;}
    if(act==='add-oneoff'){openModal('oneoff');return;}
    if(act==='edit-settings'){openModal('settings');return;}
    if(act==='edit'){openModal(btn.dataset.type,btn.dataset.id);return;}
    if(act==='delete'){removeItem(btn.dataset.type,btn.dataset.id);return;}
    if(act==='toggle-paid'){state.paid[btn.dataset.id]=!state.paid[btn.dataset.id];if(!state.paid[btn.dataset.id])delete state.paid[btn.dataset.id];save();return;}
    if(act==='export'){exportBackup();return;}
    if(act==='import'){el('import-file')?.click();return;}
    if(act==='demo'){if(!confirm('Örnek verileri yüklemek mevcut tüm kayıtlarını değiştirir. Önce yedek almanı öneririz. Devam edilsin mi?'))return;demoData();return;}
    if(act==='clear-data'){if(!confirm('Tüm kart, taksit, gelir ve gider kayıtların kalıcı olarak silinecek. Yedek aldın mı?'))return;
      if(!confirm('Emin misin? Bu işlem geri alınamaz.'))return;state=freshState();save();toast('Tüm veriler temizlendi.');}
  });
  document.addEventListener('submit',(ev)=>{if(ev.target.id==='edit-form'){ev.preventDefault();submitForm(ev.target);}});
  document.addEventListener('change',async(ev)=>{
    if(ev.target.id!=='import-file')return;
    const file=ev.target.files?.[0];if(!file)return;
    try{
      if(file.size>2*1024*1024)throw Error('Yedek dosyası 2 MB’tan büyük olamaz.');
      const imported=validateBackup(JSON.parse(await file.text()));
      if(!confirm('Yedek yüklendiğinde mevcut tüm finans kayıtların değişecek. Onaylıyor musun?'))return;
      state=imported;save();toast('Yedek başarıyla geri yüklendi.');
    }catch(err){alert('Yedek yüklenemedi: '+err.message);}finally{ev.target.value='';}
  });
  el('previous-month').addEventListener('click',()=>{selectedMonth=shiftMonth(selectedMonth,-1);render();});
  el('next-month').addEventListener('click',()=>{selectedMonth=shiftMonth(selectedMonth,1);render();});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&el('modal-root').classList.contains('open'))closeModal();});
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  render();
})();
