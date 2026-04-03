#!/bin/bash

set -e

if [ ! -d node_modules ]; then
  npm install --no-prepare
fi

npm run start:dev -- -b swc
