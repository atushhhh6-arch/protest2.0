import './style.css';

const MODEL_IMAGE = './white-tee-front-back.jpg';

const slots = {
  front: [
    { id:'F01', name:'Left Chest', price:200, x:36, y:31, w:13, h:10 },
    { id:'F02', name:'Right Chest', price:200, x:51, y:31, w:13, h:10 },
    { id:'F03', name:'Centre Rectangle', price:350, x:35, y:43, w:29, h:13 },
    { id:'F04', name:'Lower Left', price:150, x:37, y:59, w:12, h:10 },
    { id:'F05', name:'Lower Right', price:150, x:51, y:59, w:12, h:10 },
    { id:'F06', name:'Left Sleeve', price:100, x:22, y:31, w:12, h:10 },
    { id:'F07', name:'Right Sleeve', price:100, x:66, y:31, w:12, h:10 }
  ],
  back: [
    { id:'B01', name:'Upper Back Left', price:200, x:36, y:31, w:13, h:10 },
    { id:'B02', name:'Upper Back Right', price:200, x:51, y:31, w:13, h:10 },
    { id:'B03', name:'Back Rectangle', price:350, x:35, y:43, w:29, h:13 },
    { id:'B04', name:'Lower Back Left', price:150, x:37, y:59, w:12, h:10 },
    { id:'B05', name:'Lower Back Right', price:150, x:51, y:59, w:12, h:10 }
  ]
};

const faqs = [
  ['How much does a spot start at?','Chest and upper spots start at $200, centre rectangles at $350, lower spots at $150, and the two front sleeve placements at $100.'],
  ['Can I pay more than the minimum?','Yes. A higher confirmed payment becomes the current winning amount and the next takeover minimum becomes 2× that payment.'],
  ['What happens when someone takes my spot?','After a successful takeover, the new sponsor gets the placement and the previous sponsor receives a full refund of the amount they paid for that spot.'],
  ['When is my spot confirmed?','A placement is confirmed only after payment is successfully completed and the logo or brand passes the content check.'],
  ['How is the sponsor total calculated?','The sponsor total is the sum of the current winning payments for confirmed placements only.'],
  ['When does bidding close and printing happen?','The close time and final print timing are confirmed before production so the final T-shirt can be prepared for the visit.'],
  ['Will the T-shirt be worn until the protest ends?','No fixed protest duration is promised. The shirt is planned for confirmed attendance days and depends on access and conditions.'],
  ['What if the project cannot go ahead?','If the agreed placement cannot be delivered because the project cannot proceed, the sponsorship for that undelivered placement is refundable.'],
  ['Are views or media appearances guaranteed?','No. The project offers the agreed physical placement and creator-made documentation; reach, virality, press coverage and third-party appearances are not guaranteed.'],
  ['What logos and brands are allowed?','Brand assets must be lawful, non-deceptive and suitable for public display. A logo can be declined before confirmation if it creates legal, safety or content-policy concerns.']
];

document.querySelector('#app').innerHTML = `
<header class="topbar">
  <div class="wrap">
    <a class="brand" href="#">PROTEST <b>2.0</b></a>
    <nav>
      <a href="#story">The story</a>
      <a href="#how">How it works</a>
      <a href="#about">About me</a>
      <a href="https://x.com/Ayushkwh" target="_blank" rel="noreferrer">My profile</a>
    </nav>
    <a class="cta" href="#spots">Get a spot <span>12 +</span></a>
  </div>
</header>

<main>
  <section class="hero" id="story">
    <div class="wrap hero-grid">
      <div class="hero-copy">
        <div class="eyebrow"><span class="dot"></span>Independent creator project</div>
        <h1>REAL PEOPLE.<br>REAL STREETS.<br><em>YOUR BRAND.</em></h1>
        <p>I’m heading to Jantar Mantar on 5 October with your brand on my T-shirt. The protests began on 2 October; I’ll document my visit from the ground.</p>
        <div class="hero-actions">
          <a class="cta" href="#spots">Find your spot ＋</a>
          <a class="cta alt" href="#context">Read the context →</a>
        </div>
      </div>
      <div class="hero-meta">
        <div><strong>05 OCT</strong><span>2026 · my visit</span></div>
        <div><strong>12</strong><span>placements</span></div>
        <div><strong>7 / 5</strong><span>front / back</span></div>
      </div>
    </div>
  </section>

  <section class="section" id="spots">
    <div class="wrap">
      <div class="section-head">
        <div>
          <div class="eyebrow">01 / The T-shirt</div>
          <h2>A place in the picture.</h2>
        </div>
        <p>Choose a spot. Set your bid. The next takeover costs 2× what you pay.</p>
      </div>

      <div class="stats">
        <div class="stat"><strong>$0</strong><small>Sponsor total · current winning bids only</small></div>
        <div class="stat"><strong>0 / 12</strong><small>Confirmed spots · seven front / five back</small></div>
        <div class="stat"><strong>2×</strong><small>Takeover rule · previous sponsor gets a full refund</small></div>
      </div>

      <div class="shirt-grid">
        <div class="viewer">
          <div class="viewer-top"><span id="viewer-label">Front F01—F07</span><span id="viewer-count">07 spots</span></div>
          <div class="viewer-stage">
            <div class="photo-crop front" id="photo-crop"><img src="${MODEL_IMAGE}" alt="Ayush wearing a plain white T-shirt, front and back studio views"></div>
            <div class="slot-layer" id="slot-layer"></div>
          </div>
          <div class="side-switch">
            <button data-side="front" class="active">Front · 7 spots</button>
            <button data-side="back">Back · 5 spots</button>
          </div>
        </div>

        <aside class="spot-panel">
          <div class="panel-top"><span>Choose placement</span><span id="side-copy">Front</span></div>
          <div class="panel-copy" id="panel-copy">Chest, centre, lower front & sleeves. Two sleeve spots appear on the front only—each sleeve has one logo.</div>
          <div class="spot-list" id="spot-list"></div>
          <div class="takeover">
            <div class="eyebrow">Full-refund takeover policy</div>
            <strong>$200 → $400 → $800</strong>
            <p>Or start at $500: the next sponsor must pay at least $1,000. A successful takeover replaces the current sponsor and makes their entire previous payment refundable.</p>
          </div>
        </aside>
      </div>
    </div>
  </section>

  <section class="section" id="context">
    <div class="wrap">
      <div class="section-head">
        <div><div class="eyebrow">02 / The context</div><h2>A new chapter. A national conversation.</h2></div>
        <p>Research snapshot · 02 Oct 2026. Political claims below are presented as attributed protest demands and responses, not independent findings.</p>
      </div>
      <div class="context-grid">
        <article class="context-card">
          <div class="eyebrow">What’s happening?</div>
          <h3>Voting rights. Public accountability. Voices on the street.</h3>
          <p>Demonstrations began at Delhi’s Jantar Mantar on 2 October. Student groups and civil-society activists are demanding Chief Election Commissioner Gyanesh Kumar’s resignation and raising concerns about electoral rolls and the Special Intensive Revision (SIR). The Election Commission has defended its process. These are protesters’ allegations and demands, not findings of wrongdoing.</p>
          <div class="source-note">Source label preserved from the live project: Times of India · 2 October 2026</div>
        </article>
        <article class="visit-card">
          <div class="eyebrow">My plan</div>
          <div class="visit-date">05 <span>OCTOBER / 2026 · MY VISIT</span></div>
          <h3>Jantar Mantar<br>New Delhi, India</h3>
          <p>I’m planning to go on 5 October. I’ll wear the sponsored T-shirt on the days I attend and share photos and videos from the ground. My aim is to keep showing up while the protest continues. Attendance and duration depend on access and conditions.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div><div class="eyebrow">Looking back / the earlier 2026 protest</div><h2>The story before Protest 2.0.</h2></div>
        <p>These highlights describe the earlier agitation—not the protest that began on 2 October or the audience for my 5 October visit.</p>
      </div>
      <div class="benefits">
        <article><div class="num">01</div><h3>36 days</h3><p>A July TOI Voices article described the previous CJP agitation as lasting 36 days. That duration belongs to the earlier protest.</p></article>
        <article><div class="num">02</div><h3>Across your feed.</h3><p>The earlier protest spread across Instagram, YouTube and news coverage. No combined all-platform view total is claimed here.</p></article>
        <article><div class="num">03</div><h3>Creators. Cameras.</h3><p>Public figures joined the conversation in different ways. On-site visits and online coverage are not endorsements of this project.</p></article>
        <article><div class="num">04</div><h3>Independent project.</h3><p>Protest 2.0 is a creator sponsorship project, not an official protest fund or political organisation.</p></article>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div><div class="eyebrow">03 / Your brand, in real life</div><h2>Beyond a logo.</h2></div>
        <p>Help fund the printing, travel and independent documentation. Be part of what I make.</p>
      </div>
      <div class="benefits">
        <article><div class="num">01</div><h3>A physical placement</h3><p>Your approved logo, printed on the agreed part of my T-shirt for my confirmed attendance days.</p></article>
        <article><div class="num">02</div><h3>Photos from the ground</h3><p>Real photos of the printed shirt during my visit, so you can see your placement in use.</p></article>
        <article><div class="num">03</div><h3>Creator-made coverage</h3><p>Brand visibility in the content we agree on. Content commitments and attendance dates are confirmed before checkout.</p></article>
        <article><div class="num">04</div><h3>A clickable brand profile</h3><p>Your sponsor profile can hold your logo, website, X handle and brand description.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="how">
    <div class="wrap">
      <div class="section-head">
        <div><div class="eyebrow">04 / How it works</div><h2>From your screen. To my T-shirt.</h2></div>
      </div>
      <div class="steps">
        <article><div class="num">01</div><h3>Pick a placement.</h3><p>Choose from 12 positions: upper spots $200, centre rectangles $350, lower spots $150 and two sleeve spots $100.</p></article>
        <article><div class="num">02</div><h3>Make it your own.</h3><p>Add your brand, description, website and X handle. Upload your logo for the placement.</p></article>
        <article><div class="num">03</div><h3>Set your amount.</h3><p>Pay at least the displayed minimum. A higher amount raises the next takeover price to twice what you paid.</p></article>
        <article><div class="num">04</div><h3>Take over. Refund.</h3><p>A successful takeover gives the spot to the new sponsor. The previous sponsor receives a full refund of their paid sponsorship.</p></article>
      </div>
    </div>
  </section>

  <section class="section" id="about">
    <div class="wrap about-grid">
      <aside class="about-card">
        <div><div class="avatar">A</div></div>
        <div><div class="eyebrow">Ayush’s profile</div><a class="handle" href="https://x.com/Ayushkwh" target="_blank" rel="noreferrer">𝕏 @Ayushkwh ↗</a></div>
      </aside>
      <article class="about-copy">
        <div class="eyebrow">05 / The person wearing it</div>
        <h2>Hey, I’m Ayush.</h2>
        <p>I edit, design and keep trying to build things. I’m a video editor and graphic designer. Creative work is how I earn, and building ideas into real projects is what keeps me curious. I’m still learning, experimenting and improving with every launch.</p>
        <p>This is my independent sponsorship project. It supports my T-shirt, travel and documentation—not an official protest fund or a political organisation.</p>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="wrap lineup">
      <div class="eyebrow">06 / The current lineup</div>
      <div class="section-head"><div><h2>On the T-shirt.</h2></div><p>The brands on this project.</p></div>
      <div class="empty-lineup">
        <strong>Confirmed sponsors will appear here.</strong>
        <p>The first brand could be yours. Explore a placement above to see its starting bid. No completed takeovers yet.</p>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <div><div class="eyebrow">07 / Fair questions</div><h2>Clear bids. Clear rules.</h2></div>
      </div>
      <div class="faq" id="faq"></div>
    </div>
  </section>

  <section class="final-cta">
    <div class="wrap">
      <div class="eyebrow">Small space. Real presence.</div>
      <h2>Your next placement<br>could be right here.</h2>
      <a class="cta" href="#spots">Pick your spot ＋</a>
    </div>
  </section>
</main>

<footer>
  <div class="wrap footer-grid">
    <a class="brand" href="#">PROTEST <b>2.0</b></a>
    <div class="footer-links"><a href="#terms">Terms</a><a href="#privacy">Privacy</a><a href="#refund">Refund Policy</a><a href="#content-policy">Content Policy</a></div>
    <div class="footer-note">Independent creator sponsorship. New Delhi, India · 2026.</div>
  </div>
</footer>

<div class="modal" id="spot-modal" aria-hidden="true">
  <div class="modal-card">
    <div class="modal-head"><strong id="modal-id">F01</strong><button id="modal-close" aria-label="Close">×</button></div>
    <div class="modal-body">
      <h3 id="modal-name">Left Chest</h3>
      <p>Send the brand details for this placement. The payment layer can be connected separately; this repository does not fake a completed payment.</p>
      <div class="bid-box"><div class="eyebrow">Starting bid</div><strong id="modal-price">$200</strong><p>Next takeover minimum after a confirmed $200 payment: $400.</p></div>
      <form class="form-grid" id="sponsor-form">
        <input name="brand" placeholder="Brand name" required>
        <input name="website" placeholder="Website">
        <input name="x" placeholder="X handle">
        <textarea name="description" placeholder="Short brand description"></textarea>
        <input name="amount" type="number" min="100" step="1" placeholder="Your amount">
        <button type="submit">Save sponsorship draft</button>
      </form>
      <p class="form-note">Drafts are saved in this browser only. They do not create a confirmed sponsor or charge a payment.</p>
    </div>
  </div>
</div>
`;

let side = 'front';
let selected = slots.front[0];

const layer = document.querySelector('#slot-layer');
const list = document.querySelector('#spot-list');
const crop = document.querySelector('#photo-crop');
const modal = document.querySelector('#spot-modal');

function money(n){ return '$' + n.toLocaleString('en-US'); }

function openSpot(spot){
  selected = spot;
  document.querySelector('#modal-id').textContent = spot.id;
  document.querySelector('#modal-name').textContent = spot.name;
  document.querySelector('#modal-price').textContent = money(spot.price);
  const amount = document.querySelector('#sponsor-form [name="amount"]');
  amount.min = spot.price;
  amount.value = spot.price;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  render();
}

function render(){
  const current = slots[side];
  crop.className = 'photo-crop ' + side;
  document.querySelector('#viewer-label').textContent = side === 'front' ? 'Front F01—F07' : 'Back B01—B05';
  document.querySelector('#viewer-count').textContent = String(current.length).padStart(2,'0') + ' spots';
  document.querySelector('#side-copy').textContent = side === 'front' ? 'Front' : 'Back';
  document.querySelector('#panel-copy').textContent = side === 'front'
    ? 'Chest, centre, lower front & sleeves. Two sleeve spots appear on the front only—each sleeve has one logo.'
    : 'Upper back, centre & lower back. No extra shoulder/sleeve placement is added on the back.';
  document.querySelectorAll('[data-side]').forEach(btn => btn.classList.toggle('active', btn.dataset.side === side));
  layer.innerHTML = '';
  list.innerHTML = '';

  current.forEach(spot => {
    const overlay = document.createElement('button');
    overlay.className = 'shirt-slot' + (selected.id === spot.id ? ' active' : '');
    overlay.style.cssText = `left:${spot.x}%;top:${spot.y}%;width:${spot.w}%;height:${spot.h}%`;
    overlay.innerHTML = `<span>${spot.id}</span><b>${money(spot.price)}</b>`;
    overlay.addEventListener('click', () => openSpot(spot));
    layer.appendChild(overlay);

    const row = document.createElement('button');
    row.className = 'spot-row' + (selected.id === spot.id ? ' active' : '');
    row.innerHTML = `<span class="id">${spot.id}</span><span><strong>${spot.name}</strong><small>starts at ${money(spot.price)}</small></span><span class="price">${money(spot.price)}</span>`;
    row.addEventListener('click', () => openSpot(spot));
    list.appendChild(row);
  });
}

document.querySelectorAll('[data-side]').forEach(btn => btn.addEventListener('click', () => {
  side = btn.dataset.side;
  selected = slots[side][0];
  render();
}));

document.querySelector('#modal-close').addEventListener('click', () => {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
});
modal.addEventListener('click', e => {
  if(e.target === modal) document.querySelector('#modal-close').click();
});

document.querySelector('#sponsor-form').addEventListener('submit', e => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget));
  data.spot = selected.id;
  data.savedAt = new Date().toISOString();
  localStorage.setItem('protest2-sponsor-draft-' + selected.id, JSON.stringify(data));
  e.currentTarget.querySelector('button').textContent = 'Draft saved ✓';
  setTimeout(() => e.currentTarget.querySelector('button').textContent = 'Save sponsorship draft', 1600);
});

document.querySelector('#faq').innerHTML = faqs.map(([q,a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');

render();
