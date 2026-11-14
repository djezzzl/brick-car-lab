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
    stop: {
      caveats: [
        'All cars have the same brakes. A heavy car has more momentum, so the same brakes slow it down less each second.',
        'Grippy tyres let you brake harder before they skid.',
        'Watch the purple flag while driving: it shows where you would stop if you braked right now.'
      ],
      checks: [
        { test: function (s) { return s.brakeDecel >= 8; }, ok: function (s) { return 'Brakes slow you by ' + s.brakeDecel.toFixed(1) + ' m/s every second.'; }, bad: function (s) { return 'Heavy car: brakes only slow you by ' + s.brakeDecel.toFixed(1) + ' m/s each second. Use lighter bricks.'; } },
        { test: function (s) { return s.tipLimitG >= 0.8; }, ok: function () { return 'Low enough not to nose-dive too much.'; }, bad: function () { return 'Tall car: it will lean forward a lot when braking.'; } },
        { test: function (s) { return s.zeroTo100 != null && s.zeroTo100 < 10; }, ok: function () { return 'Enough power to reach 80 km/h for ⭐⭐⭐.'; }, bad: function () { return 'Slow engine: you may not reach 80 km/h for 3 stars.'; } }
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
        { test: function (s) { return s.wheelR >= 0.5; }, ok: function (s) { return 'Wheels ' + cm(s.wheelR) + ' cm radius roll over the 50 cm step.'; }, bad: function (s) { return 'Wheels are small (' + cm(s.wheelR) + ' cm). The 50 cm step is a wall for them.'; } },
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
    jump: {
      caveats: [
        'You need about 60 km/h at the top of the ramp to fly across.',
        'Driving up the ramp steals speed (gravity again!), so arrive at the ramp as fast as you can.',
        'Balanced weight (middle of the car) keeps it flying level. Soft suspension helps the landing.'
      ],
      checks: [
        { test: function (s) { return s.zeroTo100 != null && s.zeroTo100 < 9; }, ok: function () { return 'Quick car – you will be fast at take-off.'; }, bad: function () { return 'Slow to speed up – you might not reach the far side.'; } },
        { test: function (s) { return s.frontWeight > 0.35 && s.frontWeight < 0.65; }, ok: function () { return 'Weight is balanced – flies level.'; }, bad: function () { return 'Weight is all at one end – the car will nose-dive or flip in the air.'; } },
        { test: function (s) { return s.travel >= 0.15; }, ok: function () { return 'Suspension can soak up the landing.'; }, bad: function () { return 'Very stiff, short suspension – hard landing!'; } }
      ]
    },
    eight: {
      caveats: [
        'Turning pull = v² ÷ r. Twice the speed needs FOUR times the pull!',
        'Tall + narrow cars tip over. Low + wide cars slide instead – sliding only loses time.',
        'Spoilers push the car down so the tyres can pull harder in fast corners.',
        'Look at the crossing: slow down or speed up so you do not meet the other car.'
      ],
      checks: [
        { test: function (s) { return s.tipLimitG > s.gripRoad; }, ok: function (s) { return 'Tip-over limit ' + s.tipLimitG.toFixed(2) + ' g is above grip ' + s.gripRoad + ' g: you would slide, not tip.'; }, bad: function (s) { return 'Tip-over limit ' + s.tipLimitG.toFixed(2) + ' g is below grip ' + s.gripRoad + ' g: you will TIP OVER first! Go lower or wider.'; } },
        { test: function (s) { return s.hCoM <= 0.8; }, ok: function (s) { return 'Centre of mass is low (' + s.hCoM.toFixed(2) + ' m).'; }, bad: function (s) { return 'Centre of mass is high (' + s.hCoM.toFixed(2) + ' m). Put heavy parts at the bottom.'; } },
        { test: function (s) { return s.width >= 1.8; }, ok: function () { return 'Wide axles – harder to tip.'; }, bad: function () { return 'Narrow axles tip easily in corners.'; } }
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
