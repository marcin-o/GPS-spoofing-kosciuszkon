# GPS Spoofing Sentinel — Backend

Minimalny szkielet FastAPI dla projektu hackathonowego.

## Uruchomienie lokalne

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Konfiguracja

Skopiuj `.env.example` do `.env` i dostosuj wartości:

```bash
cp .env.example .env
```

## Dokumentacja API

Po uruchomieniu serwera Swagger UI dostępne jest pod:

http://localhost:8000/docs

## Struktura

```
backend/
├── app/
│   ├── main.py          # FastAPI app + CORS + routery
│   ├── config.py        # ustawienia (pydantic-settings)
│   ├── routers/         # health, flights, demo, incidents, detection
│   ├── schemas/         # modele Pydantic
│   └── data/            # mocki JSON i trajektorie
├── requirements.txt
├── .env.example
└── README.md
```
