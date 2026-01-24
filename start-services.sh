#!/bin/bash

# Music Analyzer - Service Startup Script
# This script checks dependencies and starts all services

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Music Analyzer - Service Manager${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for required system dependencies
echo -e "${YELLOW}Checking system dependencies...${NC}"

# Check FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} FFmpeg installed: $(ffmpeg -version 2>&1 | head -n1)"
else
    echo -e "  ${RED}✗${NC} FFmpeg NOT installed"
    echo -e "    Install with: ${YELLOW}brew install ffmpeg${NC}"
    MISSING_DEPS=1
fi

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Node.js installed: $(node --version)"
else
    echo -e "  ${RED}✗${NC} Node.js NOT installed"
    echo -e "    Install with: ${YELLOW}brew install node${NC}"
    MISSING_DEPS=1
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Python installed: $(python3 --version)"
else
    echo -e "  ${RED}✗${NC} Python NOT installed"
    echo -e "    Install with: ${YELLOW}brew install python${NC}"
    MISSING_DEPS=1
fi

# Check yt-dlp
if command -v yt-dlp &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} yt-dlp installed"
else
    echo -e "  ${YELLOW}!${NC} yt-dlp not installed (optional, for YouTube extraction)"
    echo -e "    Install with: ${YELLOW}brew install yt-dlp${NC}"
fi

if [ "$MISSING_DEPS" = "1" ]; then
    echo ""
    echo -e "${RED}Missing required dependencies. Please install them first.${NC}"
    exit 1
fi

echo ""

# Check/create Python virtual environment
echo -e "${YELLOW}Checking Python virtual environment...${NC}"
if [ ! -d "venv" ]; then
    echo -e "  Creating virtual environment..."
    python3 -m venv venv
    echo -e "  ${GREEN}✓${NC} Virtual environment created"
fi

# Activate venv and install Python dependencies
echo -e "  Installing Python dependencies..."
source venv/bin/activate

if [ -f "requirements-gemini.txt" ]; then
    pip install -q -r requirements-gemini.txt 2>/dev/null || true
fi
if [ -f "requirements-rhythm.txt" ]; then
    pip install -q -r requirements-rhythm.txt 2>/dev/null || true
fi
if [ -f "requirements-stem.txt" ]; then
    pip install -q -r requirements-stem.txt 2>/dev/null || true
fi

echo -e "  ${GREEN}✓${NC} Python dependencies installed"
echo ""

# Check/install Node dependencies
echo -e "${YELLOW}Checking Node.js dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "  Installing root dependencies..."
    npm install --silent
fi
if [ ! -d "client/node_modules" ]; then
    echo -e "  Installing client dependencies..."
    cd client && npm install --silent && cd ..
fi
echo -e "  ${GREEN}✓${NC} Node.js dependencies installed"
echo ""

# Kill any existing services on our ports
echo -e "${YELLOW}Stopping any existing services...${NC}"
for port in 56400 56401 56402 56403 56404; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null || true
        echo -e "  Stopped process on port $port"
    fi
done
sleep 1
echo -e "  ${GREEN}✓${NC} Ports cleared"
echo ""

# Start services
echo -e "${YELLOW}Starting services...${NC}"
echo ""

# Create logs directory
mkdir -p logs

# Start Express Backend (port 56404)
echo -e "  Starting Express Backend (port 56404)..."
node server.js > logs/express.log 2>&1 &
EXPRESS_PID=$!
sleep 1
if kill -0 $EXPRESS_PID 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Express Backend running (PID: $EXPRESS_PID)"
else
    echo -e "  ${RED}✗${NC} Express Backend failed to start. Check logs/express.log"
fi

# Start Gemini Analyzer (port 56401)
if [ -f "gemini_analyzer.py" ]; then
    echo -e "  Starting Gemini Analyzer (port 56401)..."
    ./venv/bin/python gemini_analyzer.py > logs/gemini.log 2>&1 &
    GEMINI_PID=$!
    sleep 1
    if kill -0 $GEMINI_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Gemini Analyzer running (PID: $GEMINI_PID)"
    else
        echo -e "  ${YELLOW}!${NC} Gemini Analyzer failed (optional)"
    fi
fi

# Start Stem Separator (port 56402)
if [ -f "stem_separator.py" ]; then
    echo -e "  Starting Stem Separator (port 56402)..."
    ./venv/bin/python stem_separator.py > logs/stem.log 2>&1 &
    STEM_PID=$!
    sleep 1
    if kill -0 $STEM_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Stem Separator running (PID: $STEM_PID)"
    else
        echo -e "  ${YELLOW}!${NC} Stem Separator failed (optional)"
    fi
fi

# Start Rhythm Analyzer (port 56403)
if [ -f "rhythm_analyzer.py" ]; then
    echo -e "  Starting Rhythm Analyzer (port 56403)..."
    ./venv/bin/python rhythm_analyzer.py > logs/rhythm.log 2>&1 &
    RHYTHM_PID=$!
    sleep 1
    if kill -0 $RHYTHM_PID 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} Rhythm Analyzer running (PID: $RHYTHM_PID)"
    else
        echo -e "  ${YELLOW}!${NC} Rhythm Analyzer failed (optional)"
    fi
fi

# Start React Frontend (port 56400)
echo -e "  Starting React Frontend (port 56400)..."
cd client
PORT=56400 npm start > ../logs/client.log 2>&1 &
CLIENT_PID=$!
cd ..
sleep 3
if kill -0 $CLIENT_PID 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} React Frontend running (PID: $CLIENT_PID)"
else
    echo -e "  ${RED}✗${NC} React Frontend failed to start. Check logs/client.log"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}All services started!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Service URLs:"
echo -e "  ${GREEN}React App:${NC}        http://localhost:56400"
echo -e "  ${GREEN}Gemini Analyzer:${NC}  http://localhost:56401"
echo -e "  ${GREEN}Stem Separator:${NC}   http://localhost:56402"
echo -e "  ${GREEN}Rhythm Analyzer:${NC}  http://localhost:56403"
echo -e "  ${GREEN}Express Backend:${NC}  http://localhost:56404"
echo ""
echo -e "Logs are in: ${YELLOW}./logs/${NC}"
echo -e "Stop all with: ${YELLOW}./stop-services.sh${NC}"
echo ""
