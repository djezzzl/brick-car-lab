// Screen routing, saving the current car, the track list and the record book.
(function (B) {
  var KEY = 'bcl.design';

  function loadDesign() {
    return B.migrate(B.load(KEY, null)) || B.PRESETS.sport();
  }

  function show(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.hidden = s.id !== id; });
    document.querySelectorAll('[data-nav]').forEach(function (b) { b.classList.toggle('active', b.dataset.nav === id); });
  }

  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

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

    var recordsTrack = null;
    function openRecords(track) {
      recordsTrack = track;
      var list = B.Records.forTrack(track.id);
      document.getElementById('records-title').textContent = '📜 ' + track.emoji + ' ' + track.name + ' – record book';
      var body = document.getElementById('records-body');
      if (!list.length) {
        body.innerHTML = '<p class="empty">No finished runs yet. Drive this track to get into the book!</p>';
      } else {
        body.innerHTML = '<table class="records"><thead><tr><th>#</th><th>Car</th><th>Time</th><th>Stars</th><th>Flips</th><th>Weight</th><th>Power</th><th>Wheels</th><th>Clearance</th><th></th></tr></thead><tbody>' +
          list.map(function (r, i) {
            var medal = ['🥇', '🥈', '🥉'][i] || (i + 1);
            return '<tr><td class="medal">' + medal + '</td><td class="car"><canvas width="140" height="64" data-i="' + i + '"></canvas><div>' + esc(r.name) + '</div></td>' +
              '<td><b>' + r.time.toFixed(2) + ' s</b></td><td>' + '⭐'.repeat(r.stars) + '</td><td>' + (r.flips || '–') + '</td>' +
              '<td>' + r.mass + ' kg</td><td>' + r.power + ' kW' + (r.engines > 1 ? '<br><small>' + r.engines + ' engines</small>' : '') + '</td><td>' + r.wheels + '</td><td>' + r.clearance + ' cm</td>' +
              '<td><button data-load="' + i + '">🔧 Load</button></td></tr>';
          }).join('') + '</tbody></table>';
        body.querySelectorAll('canvas[data-i]').forEach(function (c) { B.drawCarThumb(c, list[+c.dataset.i].design); });
        body.querySelectorAll('[data-load]').forEach(function (b) {
          b.addEventListener('click', function () {
            var d = B.migrate(JSON.parse(JSON.stringify(list[+b.dataset.load].design)));
            builder.tipsTrack = track.id; sel.value = track.id;
            builder.setDesign(d);
            closeRecords(); drive.stop(); show('garage');
          });
        });
      }
      document.getElementById('records').hidden = false;
    }
    function closeRecords() { document.getElementById('records').hidden = true; }
    document.getElementById('records-close').addEventListener('click', closeRecords);
    document.getElementById('records').addEventListener('click', function (e) { if (e.target.id === 'records') closeRecords(); });
    document.getElementById('records-clear').addEventListener('click', function () {
      if (recordsTrack && window.confirm('Delete all records for ' + recordsTrack.name + '?')) { B.Records.clear(recordsTrack.id); openRecords(recordsTrack); renderTracks(); }
    });

    var drive = new B.Drive(document.getElementById('drive'), {
      onExit: function (where, track) {
        if (where === 'garage') {
          builder.tipsTrack = track.id;
          sel.value = track.id;
          builder.refresh();
          show('garage');
        } else { renderTracks(); show('tracks'); }
      },
      onRecords: openRecords
    });

    var sel = document.getElementById('tips-track');
    B.TRACKS.forEach(function (t) {
      var o = document.createElement('option');
      o.value = t.id; o.textContent = t.emoji + ' ' + t.name;
      sel.appendChild(o);
    });
    sel.value = builder.tipsTrack;

    function renderTracks() {
      var box = document.getElementById('track-list');
      box.innerHTML = '';
      B.TRACKS.forEach(function (t) {
        var card = document.createElement('div');
        card.className = 'card level-' + t.level;
        var best = B.Records.best(t.id), runs = B.Records.forTrack(t.id).length;
        var got = best ? best.stars : 0;
        card.innerHTML = '<div class="emoji">' + t.emoji + '</div><span class="level">' + ['', 'Easy', 'Medium', 'Hard'][t.level] + '</span><h3>' + t.name + '</h3>' +
          '<div class="got">' + '⭐'.repeat(got) + '☆'.repeat(3 - got) + '</div>' +
          '<p class="best">' + (best ? '🏆 Best: <b>' + best.time.toFixed(2) + ' s</b> with “' + esc(best.name) + '”' : 'No record yet – be the first!') + '</p>' +
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
        var recBtn = document.createElement('button');
        recBtn.textContent = '📜 Records (' + runs + ')';
        recBtn.addEventListener('click', function () { openRecords(t); });
        card.appendChild(go); card.appendChild(tipBtn); card.appendChild(recBtn);
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

    B.app = { builder: builder, drive: drive, show: show, renderTracks: renderTracks, openRecords: openRecords };
    show('garage');
  });
})(window.BCL);
