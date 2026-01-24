#!/bin/bash

# Music Analyzer - Service Health Check & Validation Script
# Run this to verify all services are working correctly

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Music Analyzer - Service Validator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

PASS=0
FAIL=0
WARN=0

# Function to test a service
test_service() {
    local name="$1"
    local url="$2"
    local expected="$3"

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" = "200" ]; then
        echo -e "  ${GREEN}✓${NC} $name - OK"
        ((PASS++))
        return 0
    else
        echo -e "  ${RED}✗${NC} $name - FAILED (HTTP $response)"
        ((FAIL++))
        return 1
    fi
}

# Function to test service with JSON validation
test_service_json() {
    local name="$1"
    local url="$2"
    local json_key="$3"

    response=$(curl -s "$url" 2>/dev/null || echo "{}")

    if echo "$response" | grep -q "$json_key"; then
        echo -e "  ${GREEN}✓${NC} $name - OK"
        ((PASS++))
        return 0
    else
        echo -e "  ${RED}✗${NC} $name - FAILED"
        ((FAIL++))
        return 1
    fi
}

echo -e "${YELLOW}1. Checking System Dependencies${NC}"
echo ""

# Check FFmpeg
if command -v ffmpeg &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} FFmpeg installed"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} FFmpeg NOT installed (required for audio conversion)"
    echo -e "      Install: ${YELLOW}brew install ffmpeg${NC}"
    ((FAIL++))
fi

# Check Node.js
if command -v node &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Node.js installed ($(node --version))"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} Node.js NOT installed"
    ((FAIL++))
fi

# Check Python
if command -v python3 &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} Python installed ($(python3 --version 2>&1 | cut -d' ' -f2))"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} Python NOT installed"
    ((FAIL++))
fi

# Check yt-dlp (optional)
if command -v yt-dlp &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} yt-dlp installed (optional)"
    ((PASS++))
else
    echo -e "  ${YELLOW}!${NC} yt-dlp not installed (optional, for YouTube)"
    ((WARN++))
fi

echo ""
echo -e "${YELLOW}2. Checking Service Health${NC}"
echo ""

# Test Express Backend
test_service_json "Express Backend (56404)" "http://localhost:56404/api/health" '"status":"ok"'

# Test Gemini Analyzer
test_service_json "Gemini Analyzer (56401)" "http://localhost:56401/health" '"status":"ok"'

# Test Stem Separator
test_service_json "Stem Separator (56402)" "http://localhost:56402/health" '"status":"ok"'

# Test Rhythm Analyzer
test_service_json "Rhythm Analyzer (56403)" "http://localhost:56403/health" '"status"'

# Test React App
test_service "React Frontend (56400)" "http://localhost:56400" "200"

echo ""
echo -e "${YELLOW}3. Checking API Endpoints${NC}"
echo ""

# Test conversion endpoint availability
response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:56404/api/convert" 2>/dev/null || echo "000")
if [ "$response" = "400" ] || [ "$response" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Audio Conversion API - Available"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} Audio Conversion API - Not responding"
    ((FAIL++))
fi

# Test Gemini models endpoint
test_service_json "Gemini Models API" "http://localhost:56401/models" '"models"'

# Test Stem models endpoint
test_service_json "Stem Models API" "http://localhost:56402/models" '"models"'

# Test Rhythm methods endpoint
test_service_json "Rhythm Methods API" "http://localhost:56403/available-methods" '"beat_detection"'

echo ""
echo -e "${YELLOW}4. Checking Python Environment${NC}"
echo ""

if [ -d "venv" ]; then
    echo -e "  ${GREEN}✓${NC} Virtual environment exists"
    ((PASS++))

    # Check key packages
    if ./venv/bin/pip show librosa &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} librosa installed"
        ((PASS++))
    else
        echo -e "  ${YELLOW}!${NC} librosa not installed"
        ((WARN++))
    fi

    if ./venv/bin/pip show demucs &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} demucs installed"
        ((PASS++))
    else
        echo -e "  ${YELLOW}!${NC} demucs not installed (stem separation won't work)"
        ((WARN++))
    fi

    if ./venv/bin/pip show noisereduce &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} noisereduce installed"
        ((PASS++))
    else
        echo -e "  ${YELLOW}!${NC} noisereduce not installed (artifact reduction disabled)"
        ((WARN++))
    fi
else
    echo -e "  ${RED}✗${NC} Virtual environment not found"
    echo -e "      Run: ${YELLOW}./start-services.sh${NC} to create it"
    ((FAIL++))
fi

echo ""
echo -e "${YELLOW}5. Running Frontend Tests${NC}"
echo ""

cd client
test_result=$(npm test -- --watchAll=false --passWithNoTests 2>&1 | tail -5)
if echo "$test_result" | grep -q "passed"; then
    passed=$(echo "$test_result" | grep -o "[0-9]* passed" | head -1)
    echo -e "  ${GREEN}✓${NC} Frontend tests: $passed"
    ((PASS++))
else
    echo -e "  ${RED}✗${NC} Frontend tests failed"
    ((FAIL++))
fi
cd ..

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Validation Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASS"
echo -e "  ${RED}Failed:${NC}   $FAIL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    echo -e "Open ${BLUE}http://localhost:56400${NC} to use the app."
    exit 0
else
    echo -e "${RED}Some checks failed.${NC}"
    echo -e "Run ${YELLOW}./start-services.sh${NC} to start missing services."
    exit 1
fi
