#!/usr/bin/env bash
# Build the wallet app for linux/amd64 and push it to ACR. The Mac is arm64,
# so the cross-build is mandatory.
#
# Usage:
#   ./build-and-push.sh v1.0.0        # tag = v1.0.0
#   ./build-and-push.sh               # tag = current UTC timestamp
set -euo pipefail

ACR_NAME="${ACR_NAME:-sherdt}"
TAG="${1:-$(date -u +%Y%m%d-%H%M%S)}"
IMAGE="${ACR_NAME}.azurecr.io/wallet:${TAG}"

echo "==> Logging in to ACR ${ACR_NAME}"
az acr login --name "${ACR_NAME}"

echo "==> Ensuring a buildx builder exists"
docker buildx inspect sherdtbuilder >/dev/null 2>&1 \
  || docker buildx create --name sherdtbuilder --use
docker buildx use sherdtbuilder

echo "==> Building and pushing ${IMAGE}"
docker buildx build --platform linux/amd64 -f Dockerfile --tag "${IMAGE}" --push .

echo "==> Done: ${IMAGE}"
echo "    Set in azure-sponsorship/terraform.tfvars:"
echo "      wallet_image_tag = \"${TAG}\""
echo "    then: terraform apply"
