// Building tips: per-track checks evaluated on the current car, plus caveats.
(function (B) {
  function kmh(v) { return Math.round(v * 3.6); }
  function cm(m) { return Math.round(m * 100); }

  B.TIPS = {
    speed: {
      caveats: [
        'Power per kilogram is king: a = F ÷ m. Same engine + lighter car = quicker.',
        'Tall cars push more air – air drag grows with speed × speed, so it limits top speed.',
        'Too much power just spins the wheels at the start – grip limits the push.'
      ],
      checks: [
        { test: function (s) { return s.powerPerKg >= 100; }, ok: function (s) { return 'Strong: ' + Math.round(s.powerPerKg) + ' W per kg.'; }, bad: function (s) { return 'Only ' + Math.round(s.powerPerKg) + ' W per kg. Try a bigger engine or foam bricks.'; } },
        { test: function (s) { return s.height <= 1.6; }, ok: function (s) { return 'Low car (' + s.height.toFixed(1) + ' m) – slips through the air.'; }, bad: function (s) { return 'Car is ' + s.height.toFixed(1) + ' m tall – a big wall for the air to push.'; } },
        { test: function (s) { return s.topSpeed * 3.6 >= 150; }, ok: function (s) { return 'Top speed about ' + kmh(s.topSpeed) + ' km/h.'; }, bad: function (s) { return 'Top speed only about ' + kmh(s.topSpeed) + ' km/h.'; } }
      ]
    },
    bad: {
      caveats: [
        'Clearance = space under the car. A rock taller than that will scrape the floor.',
        'A wheel rolls up a step easily only when the step is lower than about half the wheel.',
        'Knobbly off-road tyres grip much better on rough ground.',
        'Long (high) suspension soaks up bumps, but makes the car taller and tippier.'
      ],
      checks: [
        { test: function (s) { return s.clearance >= 0.4; }, ok: function (s) { return 'Clearance ' + cm(s.clearance) + ' cm – rocks pass under you.'; }, bad: function (s) { return 'Clearance only ' + cm(s.clearance) + ' cm – the 55 cm rock will scrape you. Try bigger wheels or higher suspension.'; } },
        { test: function (s) { return s.wheelRMin >= 0.5; }, ok: function (s) { return 'Even your smallest wheels (' + cm(s.wheelRMin) + ' cm radius) roll over the 50 cm step.'; }, bad: function (s) { return 'Your smallest wheels are ' + cm(s.wheelRMin) + ' cm radius. The 50 cm step is a wall for them – EVERY wheel has to get over it.'; } },
        { test: function (s) { return s.grip.rough >= 0.9; }, ok: function () { return 'Off-road tyres – good grip on rocks.'; }, bad: function () { return 'Slick tyres slip on rough ground. Use knobbly tyres.'; } },
        { test: function (s) { return s.wheelbase >= 2.4; }, ok: function (s) { return 'Long car (' + s.wheelbase.toFixed(1) + ' m between wheels) – stays level over holes.'; }, bad: function () { return 'Short car: it will bounce and can fall into holes.'; } }
      ]
    },
    hill: {
      caveats: [
        'Gravity pulls back: on a 38° hill it is like 60% of your weight pulling you down the hill!',
        'To not slip, tyre grip must be bigger than tan(slope). For 38° that is 0.78.',
        'Heavy bricks at the back + steep hill = wheelie and flip backwards. Keep weight in the middle or front.',
        'A run-up helps: momentum carries you part of the way up. But too fast over the top and you fly!',
        'Very low cars can get stuck with their belly on top of a sharp hill top. A bit more clearance helps.'
      ],
      checks: [
        { test: function (s) { return s.grip.dirt >= 0.78; }, ok: function (s) { return 'Grip ' + s.grip.dirt + ' on dirt beats the 38° ramp (needs 0.78).'; }, bad: function (s) { return 'Grip ' + s.grip.dirt + ' on dirt is less than 0.78 – you will slide back on 38°. Try knobbly tyres.'; } },
        { test: function (s) { return s.powerPerKg >= 70; }, ok: function (s) { return Math.round(s.powerPerKg) + ' W per kg – enough to fight gravity.'; }, bad: function (s) { return 'Only ' + Math.round(s.powerPerKg) + ' W per kg – the hill may be too hard. More power or less weight.'; } },
        { test: function (s) { return s.frontWeight >= 0.4; }, ok: function () { return 'Weight is not too far back – no flipping backwards.'; }, bad: function (s) { return 'Most weight is at the back (' + Math.round((1 - s.frontWeight) * 100) + '%). Move heavy parts forward.'; } }
      ]
    },
    roller: {
      caveats: [
        'Going UP a hill turns speed into height; going DOWN turns it back into speed.',
        'To get over a 9 m hill you need about √(2·g·h) ≈ 13 m/s (48 km/h) at the bottom – or a strong engine.',
        'Fast over a hill top = airtime! Soft, long suspension makes the landings smooth.',
        'Heavy bricks low and in the middle stop the car from flipping on landing.'
      ],
      checks: [
        { test: function (s) { return s.powerPerKg >= 80; }, ok: function (s) { return Math.round(s.powerPerKg) + ' W per kg – strong enough for the big hills.'; }, bad: function (s) { return 'Only ' + Math.round(s.powerPerKg) + ' W per kg – you may roll back on the 9 m hill.'; } },
        { test: function (s) { return s.travel >= 0.15; }, ok: function () { return 'Suspension can soak up the landings.'; }, bad: function () { return 'Very short suspension – landings will bounce you around.'; } },
        { test: function (s) { return s.frontWeight > 0.3 && s.frontWeight < 0.7; }, ok: function () { return 'Weight is balanced – flies level.'; }, bad: function () { return 'Weight is all at one end – the car will nose-dive or flip in the air.'; } }
      ]
    },
    jump: {
      caveats: [
        'You need about 60 km/h at the top of the ramp to fly over the sharks.',
        'Driving up the ramp steals speed (gravity again!) – use the booster and keep the gas pressed.',
        'Balanced weight (middle of the car) keeps it flying level. Soft suspension helps the landing.'
      ],
      checks: [
        { test: function (s) { return s.zeroTo100 != null && s.zeroTo100 < 9; }, ok: function () { return 'Quick car – you will be fast at take-off.'; }, bad: function () { return 'Slow to speed up – you might not reach the far side.'; } },
        { test: function (s) { return s.frontWeight > 0.35 && s.frontWeight < 0.65; }, ok: function () { return 'Weight is balanced – flies level.'; }, bad: function () { return 'Weight is all at one end – the car will nose-dive or flip in the air.'; } },
        { test: function (s) { return s.travel >= 0.15; }, ok: function () { return 'Suspension can soak up the landing.'; }, bad: function () { return 'Very stiff, short suspension – hard landing!'; } }
      ]
    },
    volcano: {
      caveats: [
        'Boosters push you extra hard: more force = bigger speed increment.',
        'The second lava river is 16 m wide – hit it at 65+ km/h.',
        'After the jumps comes a 16° climb on rough rock – knobbly tyres and power per kg matter.',
        'Lots of wheels share the landing bump – a long car with wheels far apart lands flatter.'
      ],
      checks: [
        { test: function (s) { return s.powerPerKg >= 100; }, ok: function (s) { return Math.round(s.powerPerKg) + ' W per kg – enough for the jumps.'; }, bad: function (s) { return 'Only ' + Math.round(s.powerPerKg) + ' W per kg – add an engine or use lighter bricks.'; } },
        { test: function (s) { return s.grip.rough >= 0.9; }, ok: function () { return 'Knobbly tyres grip the volcano rock.'; }, bad: function () { return 'Slick tyres slip on rough rock. Try knobbly tyres.'; } },
        { test: function (s) { return s.wheelbase >= 2.4; }, ok: function (s) { return 'Wheels ' + s.wheelbase.toFixed(1) + ' m apart – stable landings.'; }, bad: function () { return 'Wheels close together – the car may flip when it lands.'; } }
      ]
    },
    mega: {
      caveats: [
        'You start 30 m up. Gravity gives every car about 87 km/h at the bottom – heavy or light!',
        'Air drag slows tall, boxy cars. A wedge nose and a low body keep more speed.',
        'The kicker is steep: the car will spin in the air if the weight is at one end.',
        'Try a FLIP: weight at the back makes the nose go up in the air.'
      ],
      checks: [
        { test: function (s) { return s.cd <= 0.32; }, ok: function () { return 'Pointy shape – the air slides past.'; }, bad: function () { return 'Boxy shape – add a wedge nose (◣) at the front to cut the air.'; } },
        { test: function (s) { return s.frontWeight > 0.3 && s.frontWeight < 0.7; }, ok: function () { return 'Balanced – it will fly level.'; }, bad: function () { return 'Weight at one end – expect a flip!'; } },
        { test: function (s) { return s.travel >= 0.15; }, ok: function () { return 'Suspension ready for a big landing.'; }, bad: function () { return 'Short suspension – the landing will be hard.'; } }
      ]
    }
  };

  B.evaluateTips = function (trackId, stats) {
    var t = B.TIPS[trackId];
    return {
      caveats: t.caveats,
      checks: t.checks.map(function (c) { var ok = c.test(stats); return { ok: ok, text: ok ? c.ok(stats) : c.bad(stats) }; })
    };
  };
})(window.BCL);
