// Screen routing and saving the current car.
(function (B) {
  var KEY = 'bcl.design';

  function loadDesign() {
    var d = B.load(KEY, null);
    if (d && Array.isArray(d.pieces) && B.WHEELS[d.wheel] && B.TYRES[d.tyre] && B.LIFTS[d.lift] && B.WIDTHS[d.width]) return d;
    return B.PRESETS.sport();
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    document.querySelectorAll('[data-nav]').forEach(function (b) { b.classList.toggle('active', b.dataset.nav === id); });
  }

  window.addEventListener('DOMContentLoaded', function () {
    var problems = [];
    var builder = new B.Builder(document.getElementById('garage'), {
      design: loadDesign(),
      onChange: function (d, s, p) {
        problems = p;
        B.save(KEY, d);
        document.querySelectorAll('.need-car').forEach(function (b) { b.disabled = p.length > 0; });
      }
    });

    var drive = new B.Drive(document.getElementById('drive'), {
      onExit: function (where, track) {
        if (where === 'garage') {
          builder.tipsTrack = track.id;
          document.getElementById('tips-track').value = track.id;
          builder.refresh();
          show('garage');
        } else { renderTracks(); show('tracks'); }
      }
    });

    var sel = document.getElementById('tips-track');
    B.TRACKS.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id; o.textContent = t.emoji + ' ' + t.name;
      sel.appendChild(o);
    });
    sel.value = builder.tipsTrack;

    function renderTracks() {
      var stars = B.load('bcl.stars', {});
      var box = document.getElementById('track-list');
      box.innerHTML = '';
      B.TRACKS.forEach(function (t) {
        var card = document.createElement('div');
        card.className = 'card';
        var got = stars[t.id] || 0;
        card.innerHTML = '<div class="emoji">' + t.emoji + '</div><h3>' + t.name + '</h3>' +
          '<div class="got">' + '⭐'.repeat(got) + '☆'.repeat(3 - got) + '</div>' +
          '<p class="challenge">' + t.challenge + '</p><p class="lesson">🧪 ' + t.lesson + '</p><p class="hint">' + t.starHint + '</p>';
        var tips = B.evaluateTips(t.id, builder.stats).checks;
        var warn = tips.filter(function (c) { return !c.ok; }).length;
        var go = document.createElement('button');
        go.className = 'big need-car';
        go.textContent = '▶ Drive' + (warn ? '  (⚠️ ' + warn + ' tip' + (warn > 1 ? 's' : '') + ')' : '');
        go.disabled = problems.length > 0;
        go.addEventListener('click', function () { show('drive'); drive.start(builder.design, t); });
        var tipBtn = document.createElement('button');
        tipBtn.textContent = '🔧 Build for this';
        tipBtn.addEventListener('click', function () { builder.tipsTrack = t.id; sel.value = t.id; builder.refresh(); show('garage'); });
        card.appendChild(go); card.appendChild(tipBtn);
        box.appendChild(card);
      });
    }

    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.addEventListener('click', function () {
        drive.stop();
        if (b.dataset.nav === 'tracks') renderTracks();
        show(b.dataset.nav);
      });
    });
    document.getElementById('btn-to-tracks').addEventListener('click', function () { renderTracks(); show('tracks'); });

    B.app = { builder: builder, drive: drive, show: show, renderTracks: renderTracks };
    show('garage');
  });
})(window.BCL);
