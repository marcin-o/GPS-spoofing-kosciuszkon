# GPS Spoofing Sentinel — top-level orchestration.
# Reproducibility lever per PRD §5.4: one clone + `make install` + `make demo`
# must boot the full stack.

PYTHON ?= python3
VENV   ?= backend/.venv
PIP    := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn
PYTEST := $(VENV)/bin/pytest
JUPYTER := $(VENV)/bin/jupyter
NOTEBOOK := ml/notebooks/03_model_training.ipynb

.PHONY: help install install-backend install-frontend dev demo backend frontend train test voice clean

help:
	@echo "Targets:"
	@echo "  install   — backend venv + pip deps + frontend npm deps"
	@echo "  dev       — run backend (uvicorn --reload) and frontend (next dev) in parallel"
	@echo "  demo      — same as dev but with NEXT_PUBLIC_USE_MSW=false (real backend)"
	@echo "  train     — execute ml/notebooks/03_model_training.ipynb"
	@echo "  voice     — regenerate voice-backup MP3s (requires piper + ffmpeg)"
	@echo "  test      — pytest backend/tests"
	@echo "  clean     — drop venv and frontend node_modules"

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
	cd backend && ../$(VENV)/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev

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
	cd backend && PYTHONPATH=. ../$(VENV)/bin/pytest tests -q

clean:
	rm -rf $(VENV) frontend/node_modules
