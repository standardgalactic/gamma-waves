#!/usr/bin/bash

printf "%-45s %10s %10s\n" "FILE" "LINES" "BYTES"

find entropys_edge_web_v* -type f | sort | while read f; do
    lines=$(wc -l < "$f")
    bytes=$(wc -c < "$f")
    printf "%-45s %10d %10d\n" "$f" "$lines" "$bytes"
done | column -t

