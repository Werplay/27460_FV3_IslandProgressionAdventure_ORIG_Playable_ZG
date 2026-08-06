#!/usr/bin/env bash
#
# build-all.sh — Build this playable for every ad network supported by
# @smoud/playable-scripts. Each network is emitted into its own folder under
# dist/<network>/ so nothing collides.
#
# Usage:
#   ./build-all.sh                 # build every network
#   ./build-all.sh applovin unity  # build only the listed networks
#
set -euo pipefail

cd "$(dirname "$0")"

# All networks supported by the SDK (see
# node_modules/@smoud/playable-scripts/core/utils/parseArgvOptions.js).
ALL_NETWORKS=(
  preview
  applovin
  unity
  google
  ironsource
  facebook
  moloco
  adcolony
  mintegral
  vungle
  tapjoy
  snapchat
  tiktok
  appreciate
  chartboost
  pangle
  mytarget
  liftoff
  smadex
  adikteev
  bigabid
  inmobi
)

# Networks that only produce a zip when --zip is passed explicitly.
ZIP_OPT_IN=(facebook moloco)

# Build the target list from CLI args, or default to every network.
if [ "$#" -gt 0 ]; then
  NETWORKS=("$@")
else
  NETWORKS=("${ALL_NETWORKS[@]}")
fi

OUT_ROOT="dist"
FAILED=()

echo "==> Building ${#NETWORKS[@]} network(s) into ${OUT_ROOT}/"

for network in "${NETWORKS[@]}"; do
  out_dir="${OUT_ROOT}/${network}"

  # Add --zip for networks that need the flag to emit a zip package.
  extra=()
  for z in "${ZIP_OPT_IN[@]}"; do
    if [ "$z" = "$network" ]; then
      extra+=(--zip)
      break
    fi
  done

  echo ""
  echo "==> [$network] building -> ${out_dir}"
  rm -rf "$out_dir"
  if npx playable-scripts build "$network" --out-dir "$out_dir" ${extra[@]+"${extra[@]}"}; then
    echo "==> [$network] OK"
  else
    echo "==> [$network] FAILED"
    FAILED+=("$network")
  fi
done

echo ""
echo "======================================================================"
if [ "${#FAILED[@]}" -eq 0 ]; then
  echo "All ${#NETWORKS[@]} build(s) succeeded. Output in ${OUT_ROOT}/"
else
  echo "Completed with ${#FAILED[@]} failure(s): ${FAILED[*]}"
  exit 1
fi
