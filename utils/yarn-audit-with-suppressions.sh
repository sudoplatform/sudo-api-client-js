#!/bin/sh

yarn audit --json --groups dependencies | jq -s -c 'map(select(.type == "auditAdvisory").data.advisory) | unique_by(.id) | .[] | {id, title, module_name, vulnerable_versions, patched_versions, severity}' | (new=""; while read advisory ; do
  id=$(echo "${advisory}" | jq '.id')
  suppression=$(jq ".auditSuppressions[\"$id\"] | select (. != null)" package.json)
  if [ -z "$suppression" ]; then
    echo "New advisory ${id}:"
    echo "${advisory}" | jq .
    new=1
  elif [ $(date '+%s') -gt "$suppression" ]; then
    echo "Suppression for advisory ${id} has expired. Please revisit:"
    echo "${advisory}" | jq .
    new=1
  fi
done
if [ -n "${new}" ]; then
  exit 1
fi
)
