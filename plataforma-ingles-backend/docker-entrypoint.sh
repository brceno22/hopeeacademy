#!/bin/sh
set -e
node ./node_modules/typeorm/cli.js migration:run -d dist/data-source.js
exec node dist/main.js
