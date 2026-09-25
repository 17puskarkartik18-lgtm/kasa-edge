#!/usr/bin/env bash
cd "$(dirname "$0")"
export PYTHONPATH=.

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip
    ./venv/bin/pip install -r requirements.txt
fi

echo "Starting Kasa.Edge Civic Sensing Platform on http://localhost:8000 ..."
./venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
