# GNSS Defense Monitor — top-level orchestration.
# Reproducibility lever per PRD §5.4: one clone + `make install` + `make demo`
# must boot the full stack.

PYTHON ?= python3
VENV   ?= backend/.venv
PIP    := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
JUPYTER := $(VENV)/bin/jupyter
NOTEBOOK := ml/notebooks/03_model_training.ipynb
MODELS_DIR := $(PWD)/models

.PHONY: help install install-backend install-frontend dev demo backend frontend ml-smoke scenarios train test voice clean

help:
	@echo "Targets:"
	@echo "  install   — backend venv + pip deps + frontend npm deps"
	@echo "  scenarios — regenerate backend/app/scenarios/*.csv (deterministic, fixed seed)"
	@echo "  ml-smoke  — run ML-team's CLI: python -m ml.inference --all (needs his parquet datasets)"
	@echo "  dev       — run backend (uvicorn --reload) and frontend (next dev) in parallel"
	@echo "  demo      — same as dev (real backend wired through NEXT_PUBLIC_API_BASE)"
	@echo "  test      — pytest backend/tests"
	@echo "  voice     — regenerate voice-backup MP3s (requires piper + ffmpeg)"
	@echo "  clean     — drop venv, node_modules, models, and screenshots"

install: install-backend install-frontend

install-backend:
	@test -d $(VENV) || $(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -r backend/requirements.txt

install-frontend:
	cd frontend && npm install

# `make dev` — both servers in parallel, Ctrl-C kills both.
dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) -j2 backend frontend

# `make demo` — same, but force the FE to hit the real backend.
demo:
	@trap 'kill 0' INT TERM EXIT; \
	NEXT_PUBLIC_USE_MSW=false $(MAKE) -j2 backend frontend

backend:
	cd backend && GPS_SENTINEL_MODELS=$(MODELS_DIR) PYTHONPATH=.:.. ../$(VENV)/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

frontend:
	cd frontend && npm run dev -- --hostname 127.0.0.1

# Regenerate scenario CSVs in MLdev's expected schema.
scenarios:
	PYTHONPATH=. $(VENV)/bin/python scripts/generate_scenarios.py

# Wraps MLdev's CLI — needs his parquet datasets at $GPS_SENTINEL_DATA.
ml-smoke:
	GPS_SENTINEL_MODELS=$(MODELS_DIR) PYTHONPATH=. $(VENV)/bin/python -m ml.inference --all

train:
	@if [ ! -f $(NOTEBOOK) ]; then \
		echo "[skip] $(NOTEBOOK) does not exist yet — Person C ships it"; \
		exit 0; \
	fi
	$(VENV)/bin/pip install --quiet jupyter nbconvert
	$(JUPYTER) nbconvert --to notebook --execute $(NOTEBOOK) --output 03_model_training.executed.ipynb

voice:
	$(VENV)/bin/python backend/scripts/generate_voice_backup.py

test:
	cd backend && GPS_SENTINEL_MODELS=$(MODELS_DIR) PYTHONPATH=.:.. ../$(VENV)/bin/pytest tests -q

clean:
	rm -rf $(VENV) frontend/node_modules frontend/.next models e2e/node_modules
