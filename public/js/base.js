/* Ícones, formatadores e logótipo — partilhados pelo site e pelo painel */
/* ---------- ícones ---------- */
const P={
 pin:'<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
 star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
 heart:'<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 4 4 7.4 4c2 0 3.4 1.1 4.6 2.6C13.2 5.1 14.6 4 16.6 4 20 4 22.4 7.3 21.2 10.7 19.5 15.4 12 20 12 20z"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
 sliders:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
 back:'<path d="m15 18-6-6 6-6"/>', chev:'<path d="m9 18 6-6-6-6"/>', down:'<path d="m6 9 6 6 6-6"/>',
 home:'<path d="M4 11 12 4l8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
 scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><rect x="13" y="13" width="3" height="3"/>',
 palm:'<path d="M12 21V10M12 10c-2-3-6-3-8-1M12 10c2-3 6-3 8-1M12 10c-1-3-4-5-7-4M12 10c1-3 4-5 7-4M7 21h10"/>',
 bed:'<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10" r="1.6"/>',
 cal:'<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
 food:'<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2M9 3v5a2 2 0 0 1-2 2M17 21V3c-2 1-3 4-3 7h3"/>',
 car:'<path d="M5 16V12l2-5h10l2 5v4M3 16h18v3h-3v-2H6v2H3z"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
 card:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
 lang:'<path d="M4 5h9M8.5 3v2M6 5c.5 3 2.5 5.5 5.5 7M11 5c-.5 3-3 6.5-6.5 8"/><path d="m13 21 4-10 4 10M14.5 17.5h5"/>',
 shield:'<path d="M12 3 4.5 6v5.5c0 4.5 3.2 8.2 7.5 9.5 4.3-1.3 7.5-5 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
 headset:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M20 19c0 1.5-2 2.5-5 2.5"/>',
 badge:'<path d="m12 3 2.2 1.6 2.7-.2.8 2.6 2.3 1.4-.9 2.6.9 2.6-2.3 1.4-.8 2.6-2.7-.2L12 21l-2.2-1.6-2.7.2-.8-2.6-2.3-1.4.9-2.6-.9-2.6 2.3-1.4.8-2.6 2.7.2z"/><path d="m9 12 2 2 4-4"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5"/>',
 bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
 menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
 mountain:'<path d="m3 19 6.5-11 4 6.5 2.5-3.5L21 19z"/>', museum:'<path d="M3 9 12 4l9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/>',
 city:'<path d="M4 21V9h6v12M10 21V4h7v17M17 21v-8h3v8M3 21h18M6.5 12h1M6.5 15h1M13 7h1M13 10h1M13 13h1"/>',
 hike:'<circle cx="13" cy="4.5" r="1.8"/><path d="m11 21 2-6-2.5-2 1-5 3 3h3M9 9l-2.5 4M13 15l3 6"/>',
 leaf:'<path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15zM5 19l7-7"/>', lotus:'<path d="M12 18c-3-2-4-5-4-8 2 1 3.5 2.5 4 4 .5-1.5 2-3 4-4 0 3-1 6-4 8zM12 18c-4 0-8-2-9-5 2-.5 4 0 5 1M12 18c4 0 8-2 9-5-2-.5-4 0-5 1"/>',
 grid:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
 music:'<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
 mask:'<path d="M4 5c5 1.5 11 1.5 16 0v6a8 8 0 0 1-16 0z"/><path d="M8 10h2M14 10h2M9 15c2 1.3 4 1.3 6 0"/>',
 run:'<circle cx="15" cy="4.5" r="1.8"/><path d="m5 20 4-5 3 2 2-5-4-1-3 3M14 12l3 3h3M10 11l2-4 4 1"/>',
 glass:'<path d="M7 3h4l-.5 6a2.5 2.5 0 0 1-3 0zM13 3h4l.5 6a2.5 2.5 0 0 1-3 0zM9 11v8M15 11v8M6.5 21h5M12.5 21h5"/>',
 brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
 hotel:'<path d="M4 21V4h11v17M15 9h5v12M3 21h18M7.5 8h1M11 8h1M7.5 11.5h1M11 11.5h1M7.5 15h1M11 15h1"/>',
 house:'<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>', building:'<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1"/>',
 wifi:'<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
 pool:'<path d="M3 17c2 1.3 3.5 1.3 5 0s3.5-1.3 5 0 3.5 1.3 5 0 2-1 3 0M8 14V5a2 2 0 0 1 4 0M15 14V5a2 2 0 0 1 4 0M8 9h7"/>',
 snow:'<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>', coffee:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
 park:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3"/>', spa:'<path d="M12 21c-5 0-8-3-8-7 3 0 6 1.5 8 4 2-2.5 5-4 8-4 0 4-3 7-8 7zM12 18V9M12 9c-2-2-2-4 0-6 2 2 2 4 0 6z"/>',
 kitchen:'<path d="M5 3v18M19 3v18M5 9h14M5 15h14M9 6h1M9 12h1M9 18h1"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.3 2.2 3.8 5"/>',
 guide:'<circle cx="9" cy="5" r="2"/><path d="M7 21v-6l-2-1 1-5h6l1 5M15 3v10M15 3l5 2-5 2"/>', bottle:'<path d="M10 2h4M10.5 2v4L9 8v13h6V8l-1.5-2V2M9 12h6"/>',
 camera:'<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>', share:'<path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/>',
 eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 wallet:'<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M3 10h18M16 15h2M6 6l9-3 1 3"/>', bank:'<path d="M3 9 12 4l9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
 phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>', receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>', dots:'<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
 ticket2:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>', edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>', trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>', download:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12.5 4.5 4.5L19 7"/>', x:'<path d="M6 6l12 12M18 6 6 18"/>', map:'<path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
 crown:'<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', percent:'<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>', ticket:'<path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v3h18v-3a2 2 0 0 1 0-4 2 2 0 0 0 0-4V5H3z"/><path d="M14 5v14"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>', whats:'<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9c0 3 2.5 6 6 6l1-1.5-2-1-1 .8c-1-.5-2-1.5-2.4-2.4l.8-1-1-2z"/>',
 gauge:'<path d="M4 17a8 8 0 1 1 16 0M12 13l3.5-4"/><circle cx="12" cy="13.5" r="1"/>', logout:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>', swap:'<path d="M4 9h14l-3-3M20 15H6l3 3"/>', streetfood:'<path d="M3 10h18l-2-5H5zM5 10v8M19 10v8M3 18h18M8 14h8"/>',
 cake:'<path d="M4 20V12h16v8M3 20h18M4 15c2 1 4 1 5.3 0 1.4 1 4 1 5.4 0 1.3 1 3.3 1 5.3 0M8 12V9M12 12V9M16 12V9M8 6.5v.5M12 6.5v.5M16 6.5v.5"/>', cup:'<path d="M6 8h12l-1.5 12h-9zM5 8h14M9 8l1-5h4"/>', pot:'<path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM2.5 11h19M9 7c0-1.5 1-1.5 1-3M13 7c0-1.5 1-1.5 1-3"/>'
};
const ic=(n,cls='i')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n]||''}</svg>`;
const grp=v=>String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const kz=v=>grp(v)+' Kz';
const kzOuGratis=v=>v?kz(v):'Grátis';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const LOGO_SVG=`<svg width="46" height="46" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 44s-13-11-13-22a13 13 0 0 1 26 0c0 11-13 22-13 22z" fill="#C8102E"/><circle cx="24" cy="21" r="7.5" fill="#fff"/><path d="M24 13.5a7.5 7.5 0 0 1 0 15z" fill="#111"/><circle cx="24" cy="21" r="3" fill="#F2A900"/><path d="M6 26c4 8 22 10 36-6" fill="none" stroke="#F2A900" stroke-width="2.2" stroke-linecap="round"/><path d="m38 6 6 1-3 2 2 4-2 .5-3-3-3 1-.5-1.5 2.5-1.5z" fill="#F2A900"/></svg>`;
const logo=(sub='Descubra. Viva. Partilhe.')=>`<div class="logo">${LOGO_SVG}<div><div class="t1">ANGOLA</div><div class="t2"><span class="g">365</span><span>º</span></div><small>${sub}</small></div></div>`;
