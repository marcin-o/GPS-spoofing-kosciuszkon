import requests, time, pandas as pd
from pathlib import Path

OUT = Path("/net/afscra/people/plgmateuszoracz/hackathon/data/opensky/snapshots_multitime.parquet")
OUT.parent.mkdir(parents=True, exist_ok=True)
COLS = ["icao24","callsign","origin_country","time_position","last_contact",
        "longitude","latitude","baro_altitude","on_ground","velocity","true_track",
        "vertical_rate","sensors","geo_altitude","squawk","spi","position_source","category"]

if OUT.exists():
    print(f"Cache exists: {OUT}")
else:
    snaps = []
    for i in range(8):
        t0 = time.time()
        try:
            r = requests.get(
                "https://opensky-network.org/api/states/all",
                params={"lamin": 35, "lomin": -15, "lamax": 72, "lomax": 45},
                timeout=20,
                headers={"User-Agent": "bedetector-research/1.0"},
            )
            r.raise_for_status()
            data = r.json()
            states = data.get("states") or []
            cols = COLS[: len(states[0])] if states else COLS
            df = pd.DataFrame(states, columns=cols)
            df["snapshot_time"] = data["time"]
            df["snapshot_idx"] = i
            snaps.append(df)
            print(f"snap {i+1}/8: {len(df)} aircraft, t={data['time']}")
        except Exception as e:
            print(f"snap {i+1}/8: FAILED: {type(e).__name__}: {e}")
        if i < 7:
            elapsed = time.time() - t0
            time.sleep(max(0, 15 - elapsed))

    if snaps:
        full = pd.concat(snaps, ignore_index=True)
        full.to_parquet(OUT, index=False)
        print(f"Saved {len(full)} rows to {OUT}")
    else:
        print("No snapshots fetched.")
