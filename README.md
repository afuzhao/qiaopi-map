# qiaopi-map

Static Leaflet map for exploring 50,064 qiaopi letter records. The site reads
its application data from the JSON files committed to this repository; it does
not require a private API key.

## Local development

Serve the repository over HTTP, then open the printed local URL:

```sh
python3 -m http.server 8000
```

Opening `index.html` directly as a `file://` URL will prevent the browser from
loading the JSON data.

## Data refresh

After updating `data.json`, rebuild the smaller web indexes and country chunks:

```sh
python3 scripts/build_web_data.py --input data.json --out-dir .
```

The build keeps every archival field unchanged and adds a derived `_route`
object to each web record. This object stores the interpreted direction,
destination, confidence status, and display-only repairs. Ambiguous places are
marked `needs_review` and are not plotted as if they were confirmed locations.

Run the data regressions after rebuilding:

```sh
python3 -m unittest discover -s tests -v
```

The basemap uses OpenStreetMap's public raster tile endpoint. Keep the visible
OpenStreetMap attribution if that source is changed or restyled.
