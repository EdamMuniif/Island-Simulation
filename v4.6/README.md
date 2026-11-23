# Sim v4.6 (single file)

`angolhitheemu_v4.6.html` is the current standalone sim: 60 W smart lamp, 6-PIR ring at 914 mm, adaptive dimming, 900x fixed-step run mode. It does not use the files in the repo root, which are the older 4-lamp build.

Serve and open:

```sh
python3 -m http.server 8000
# http://localhost:8000/v4.6/angolhitheemu_v4.6.html
```

Three.js loads from jsDelivr (0.170.0), so it needs internet.
