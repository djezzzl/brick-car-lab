// Record book: every finished run per track, with a snapshot of the car that did it.
(function (B) {
  var MAX = 30;

  function all() { return B.load(B.Records.key, {}); }

  B.Records = {
    key: 'bcl.records',
    forTrack: function (trackId) { return all()[trackId] || []; },

    best: function (trackId) { return B.Records.forTrack(trackId)[0] || null; },

    // Saves a finished run and returns its place in the list (1 = new record).
    add: function (trackId, design, stats, run, stars) {
      var book = all(), list = book[trackId] || [];
      var entry = {
        id: Date.now() + '-' + Math.floor(Math.random() * 1e6),
        time: Math.round(run.time * 100) / 100,
        stars: stars,
        flips: run.flips || 0,
        date: Date.now(),
        name: design.name || 'My car',
        design: JSON.parse(JSON.stringify(design)),
        mass: Math.round(stats.mass),
        power: Math.round(stats.power / 1000),
        engines: stats.engines,
        wheels: stats.wheelCount,
        clearance: Math.round(stats.clearance * 100)
      };
      list.push(entry);
      list.sort(function (a, b) { return a.time - b.time || a.date - b.date; });
      var rank = list.indexOf(entry) + 1;
      book[trackId] = list.slice(0, MAX);
      B.save(B.Records.key, book);
      return { rank: rank, total: list.length, entry: entry };
    },

    clear: function (trackId) {
      var book = all();
      delete book[trackId];
      B.save(B.Records.key, book);
    }
  };
})(window.BCL);
