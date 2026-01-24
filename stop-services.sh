#!/bin/bash

# Music Analyzer - Stop All Services

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Stopping all Music Analyzer services...${NC}"

for port in 56400 56401 56402 56403 56404; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ ! -z "$pid" ]; then
        kill $pid 2>/dev/null || true
        echo -e "  ${GREEN}✓${NC} Stopped service on port $port (PID: $pid)"
    fi
done

echo -e "${GREEN}All services stopped.${NC}"
